import { CustomError } from '../../errors';
import { OnlineOrderEntity, OrderPaymentMethod } from '../../entities/online-order.entity';
import { CreateOnlineOrderDto } from '../../dtos/online-orders';
import { OnlineOrderRepository } from '../../repositories/online-order.repository';
import { ProductCatalogPort } from '../../services/product-catalog.port';
import { IPaymentGateway } from '../../services/payment-gateway.port';
import { FeatureFlagKey, FeatureFlagPort } from '../../services';
import { resolveIvaPercent, splitGrossLineIntoNetAndTax } from '../../services/tax';
import { EvaluateOrderRiskUseCase } from './evaluate-order-risk.use-case';
import { ShippingQuotePort } from '../../services/shipping-quote.port';
import { CouponLookupPort } from '../../services/coupon-lookup.port';
import { CustomerAddressVerifyPort } from '../../services/customer-address-verify.port';
import type { CustomerRiskProfilePort } from '../../services/customer-risk-profile.port';

const EXPIRY_MINUTES: Record<OrderPaymentMethod, number> = {
  [OrderPaymentMethod.ONLINE_GATEWAY]: 30,
  [OrderPaymentMethod.WHATSAPP_MANUAL]: 24 * 60,
};

/** HTTP metadata stored on the order for future antifraud analysis (P0). */
export type CreateOnlineOrderRequestMeta = {
  ipAddress: string | null;
  userAgent: string | null;
};

export interface CreateOnlineOrderResult {
  order: OnlineOrderEntity;
  paymentUrl: string | null;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function merchandiseDiscountCop(
  type: 'PERCENT' | 'FIXED',
  value: number,
  merchandiseGross: number,
): number {
  if (merchandiseGross <= 0) return 0;
  if (type === 'PERCENT') {
    const raw = roundMoney(merchandiseGross * (value / 100));
    return Math.min(merchandiseGross, raw);
  }
  return Math.min(merchandiseGross, roundMoney(value));
}

export class CreateOnlineOrderUseCase {
  constructor(
    private readonly onlineOrderRepository: OnlineOrderRepository,
    private readonly productCatalogPort: ProductCatalogPort,
    private readonly paymentGateway?: IPaymentGateway,
    private readonly featureFlags?: FeatureFlagPort,
    private readonly evaluateRisk?: EvaluateOrderRiskUseCase,
    private readonly shippingQuote?: ShippingQuotePort,
    private readonly couponLookup?: CouponLookupPort,
    private readonly customerAddressVerify?: CustomerAddressVerifyPort,
    private readonly customerRiskProfile?: CustomerRiskProfilePort,
  ) {}

  async execute(
    dto: CreateOnlineOrderDto,
    customerId: string | null,
    requestMeta?: CreateOnlineOrderRequestMeta,
  ): Promise<CreateOnlineOrderResult> {
    if (dto.paymentMethod === OrderPaymentMethod.ONLINE_GATEWAY && !this.paymentGateway) {
      throw CustomError.badRequest('Pasarela de pagos no configurada');
    }
    if (
      dto.paymentMethod === OrderPaymentMethod.ONLINE_GATEWAY
      && this.featureFlags
      && !(await this.featureFlags.isEnabled(FeatureFlagKey.MP_ENABLED, true))
    ) {
      throw CustomError.serviceUnavailable('Pasarela temporalmente no disponible');
    }

    if (!customerId && !dto.guestEmail) {
      throw CustomError.badRequest('guestEmail es requerido para órdenes de invitado');
    }

    const sc = dto.shippingContact;
    const guestNameForStore = customerId ? null : dto.guestName ?? sc.recipientName;
    const guestPhoneForStore = customerId ? null : dto.guestPhone ?? sc.phone;

    if (dto.customerAddressId) {
      if (!customerId) {
        throw CustomError.badRequest('customerAddressId solo aplica a clientes autenticados');
      }
      if (this.customerAddressVerify) {
        await this.customerAddressVerify.assertOwnedAndCarrierReadyForCheckout(
          dto.customerAddressId,
          customerId,
        );
      }
    }

    const meta: CreateOnlineOrderRequestMeta = requestMeta ?? {
      ipAddress: null,
      userAgent: null,
    };

    const enriched: Array<{
      productId: string;
      variantId: string;
      quantity: number;
      unitPrice: number;
      productNameSnapshot: string;
      categoryId: string | null;
      weightKgPerUnit: number | null;
    }> = [];

    let subtotalNet = 0;
    let taxTotal = 0;

    for (const item of dto.items) {
      const product = await this.productCatalogPort.getForOrder(item.productId);

      if (!product) {
        throw CustomError.notFound(`Producto con ID ${item.productId} no encontrado`);
      }
      if (!product.isActive) {
        throw CustomError.badRequest(`El producto "${product.name}" no está disponible`);
      }
      if (product.retailPrice === null) {
        throw CustomError.badRequest(
          `El producto "${product.name}" no tiene precio de venta en línea configurado`,
        );
      }
      if (!product.defaultVariantId) {
        throw CustomError.internalServer(
          `Producto "${product.name}" sin variante por defecto — ejecute migración P2 o recree el producto`,
        );
      }

      const ivaPercent = resolveIvaPercent(product.productIvaRate, product.categoryIvaRate);
      const grossLine = roundMoney(product.retailPrice * item.quantity);
      const { net, tax } = splitGrossLineIntoNetAndTax(grossLine, ivaPercent);
      subtotalNet = roundMoney(subtotalNet + net);
      taxTotal = roundMoney(taxTotal + tax);

      enriched.push({
        productId: item.productId,
        variantId: product.defaultVariantId,
        quantity: item.quantity,
        unitPrice: product.retailPrice,
        productNameSnapshot: product.name,
        categoryId: product.categoryId,
        weightKgPerUnit: product.weightKg,
      });
    }

    const merchandiseGross = enriched.reduce(
      (sum, i) => roundMoney(sum + i.unitPrice * i.quantity),
      0,
    );

    let riskScore: number | null = null;
    let riskTier: string | null = null;
    if (this.evaluateRisk) {
      const strict = this.featureFlags
        ? await this.featureFlags.isEnabled(FeatureFlagKey.FRAUD_STRICT_MODE, false)
        : false;
      let customerAccountCreatedAt: Date | null = null;
      if (customerId && this.customerRiskProfile) {
        customerAccountCreatedAt = await this.customerRiskProfile.getAccountCreatedAt(customerId);
      }
      const evalResult = await this.evaluateRisk.execute({
        ipAddress: meta.ipAddress,
        guestEmail: dto.guestEmail,
        guestPhone: customerId ? dto.guestPhone : guestPhoneForStore,
        customerId,
        customerAccountCreatedAt,
        merchandiseTotalCop: merchandiseGross,
        fraudStrictMode: strict,
      });
      riskScore = evalResult.score;
      riskTier = evalResult.tier;
      if (evalResult.tier === 'HIGH') {
        throw CustomError.forbidden(
          'No pudimos validar tu pedido por políticas de seguridad. Contáctanos para completar la compra.',
        );
      }
    }

    let discountAmount = 0;
    let couponConsume: { couponId: string; discountApplied: number } | null = null;
    let couponCodeSnapshot: string | null = null;

    const couponsEnabled = this.featureFlags
      ? await this.featureFlags.isEnabled(FeatureFlagKey.COUPON_ENABLED, true)
      : true;

    if (dto.couponCode && !this.couponLookup) {
      throw CustomError.internalServer('Cupones no configurados en el servidor');
    }

    if (dto.couponCode && couponsEnabled && this.couponLookup) {
      const coupon = await this.couponLookup.findApplicable(dto.couponCode, {
        merchandiseTotalCop: merchandiseGross,
        lines: enriched.map((e) => ({ productId: e.productId, categoryId: e.categoryId })),
      });
      if (!coupon) {
        throw CustomError.badRequest('Cupón inválido o no aplicable al carrito');
      }
      discountAmount = merchandiseDiscountCop(coupon.type, coupon.value, merchandiseGross);
      couponConsume = { couponId: coupon.id, discountApplied: discountAmount };
      couponCodeSnapshot = coupon.code;
    } else if (dto.couponCode && !couponsEnabled) {
      throw CustomError.badRequest('Los cupones están temporalmente deshabilitados');
    }

    const computedShippingKg = enriched.reduce((sum, row) => {
      const w = row.weightKgPerUnit;
      if (w == null || !Number.isFinite(w) || w <= 0) return sum;
      return sum + w * row.quantity;
    }, 0);
    const roundedComputedKg = Math.round(computedShippingKg * 1000) / 1000;

    const weightKg =
      roundedComputedKg > 0
        ? roundedComputedKg
        : dto.estimatedWeightKg != null && dto.estimatedWeightKg > 0
          ? dto.estimatedWeightKg
          : 1;

    let shippingAmount = 0;
    let shippingZoneCode: string | null = null;
    if (dto.shippingZoneCode && this.shippingQuote) {
      shippingZoneCode = dto.shippingZoneCode.trim().toUpperCase();
      shippingAmount = await this.shippingQuote.quoteShippingCop(
        shippingZoneCode,
        weightKg,
        merchandiseGross,
      );
    }

    const ratio =
      merchandiseGross > 0 ? roundMoney((merchandiseGross - discountAmount) / merchandiseGross) : 0;
    const scaledSubtotalNet = roundMoney(subtotalNet * ratio);
    const scaledTax = roundMoney(taxTotal * ratio);
    const totalAmount = roundMoney(scaledSubtotalNet + scaledTax + shippingAmount);

    const expiryMs = EXPIRY_MINUTES[dto.paymentMethod] * 60 * 1000;
    const expiresAt = new Date(Date.now() + expiryMs);

    const order = await this.onlineOrderRepository.create({
      customerId,
      guestName: guestNameForStore,
      guestPhone: guestPhoneForStore,
      guestEmail: dto.guestEmail,
      shippingAddress: dto.shippingAddress,
      totalAmount,
      subtotalAmount: scaledSubtotalNet,
      taxAmount: scaledTax,
      shippingAmount,
      discountAmount,
      currencyCode: 'COP',
      paymentMethod: dto.paymentMethod,
      expiresAt,
      items: enriched.map(({ categoryId: _c, weightKgPerUnit: _w, ...rest }) => rest),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      deviceFingerprintHash: dto.deviceFingerprintHash,
      shippingZoneCode,
      riskScore,
      riskTier,
      couponCodeSnapshot,
      customerAddressId: dto.customerAddressId,
      couponConsume,
      shippingRecipientName: sc.recipientName,
      shippingRecipientDocumentType: sc.documentType,
      shippingRecipientDocumentNumber: sc.documentNumber,
      shippingLine1: sc.addressLine1,
      shippingLine2: sc.addressLine2,
      shippingCity: sc.city,
      shippingDepartment: sc.department,
      shippingPostalCode: sc.postalCode,
      shippingRecipientPhone: sc.phone,
    });

    if (dto.paymentMethod === OrderPaymentMethod.ONLINE_GATEWAY && this.paymentGateway) {
      try {
        const { url, gatewayReference } = await this.paymentGateway.generatePaymentLink(order);
        const updatedOrder = await this.onlineOrderRepository.updatePaymentLink(
          order.id,
          url,
          gatewayReference,
        );
        return { order: updatedOrder, paymentUrl: url };
      } catch (err) {
        throw err;
      }
    }

    return { order, paymentUrl: null };
  }
}
