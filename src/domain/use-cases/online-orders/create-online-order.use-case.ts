import { CustomError } from '../../errors';
import { OnlineOrderEntity, OrderPaymentMethod } from '../../entities/online-order.entity';
import { CreateOnlineOrderDto } from '../../dtos/online-orders';
import { OnlineOrderRepository } from '../../repositories/online-order.repository';
import { ProductCatalogPort } from '../../services/product-catalog.port';
import { IPaymentGateway } from '../../services/payment-gateway.port';
import { FeatureFlagKey, FeatureFlagPort } from '../../services';
import { resolveIvaPercent, splitGrossLineIntoNetAndTax } from '../../services/tax';

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

export class CreateOnlineOrderUseCase {
  constructor(
    private readonly onlineOrderRepository: OnlineOrderRepository,
    private readonly productCatalogPort: ProductCatalogPort,
    private readonly paymentGateway?: IPaymentGateway,
    private readonly featureFlags?: FeatureFlagPort,
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
      const grossLine = Math.round(product.retailPrice * item.quantity * 100) / 100;
      const { net, tax } = splitGrossLineIntoNetAndTax(grossLine, ivaPercent);
      subtotalNet = Math.round((subtotalNet + net) * 100) / 100;
      taxTotal = Math.round((taxTotal + tax) * 100) / 100;

      enriched.push({
        productId: item.productId,
        variantId: product.defaultVariantId,
        quantity: item.quantity,
        unitPrice: product.retailPrice,
        productNameSnapshot: product.name,
      });
    }

    const totalAmount = enriched.reduce(
      (sum, i) => Math.round((sum + i.unitPrice * i.quantity) * 100) / 100,
      0,
    );

    const expiryMs = EXPIRY_MINUTES[dto.paymentMethod] * 60 * 1000;
    const expiresAt = new Date(Date.now() + expiryMs);

    const order = await this.onlineOrderRepository.create({
      customerId,
      guestName: dto.guestName,
      guestPhone: dto.guestPhone,
      guestEmail: dto.guestEmail,
      shippingAddress: dto.shippingAddress,
      totalAmount,
      subtotalAmount: subtotalNet,
      taxAmount: taxTotal,
      shippingAmount: 0,
      discountAmount: 0,
      currencyCode: 'COP',
      paymentMethod: dto.paymentMethod,
      expiresAt,
      items: enriched,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      deviceFingerprintHash: dto.deviceFingerprintHash,
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
