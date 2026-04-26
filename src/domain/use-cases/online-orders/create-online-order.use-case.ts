import { CustomError } from '../../errors';
import { OnlineOrderEntity, OrderPaymentMethod } from '../../entities/online-order.entity';
import { CreateOnlineOrderDto } from '../../dtos/online-orders';
import { OnlineOrderRepository } from '../../repositories/online-order.repository';
import { ProductCatalogPort } from '../../services/product-catalog.port';
import { IPaymentGateway } from '../../services/payment-gateway.port';

const EXPIRY_MINUTES: Record<OrderPaymentMethod, number> = {
  [OrderPaymentMethod.ONLINE_GATEWAY]: 30,
  [OrderPaymentMethod.WHATSAPP_MANUAL]: 24 * 60,
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
  ) {}

  async execute(
    dto: CreateOnlineOrderDto,
    customerId: string | null,
  ): Promise<CreateOnlineOrderResult> {
    if (dto.paymentMethod === OrderPaymentMethod.ONLINE_GATEWAY && !this.paymentGateway) {
      throw CustomError.badRequest('Pasarela de pagos no configurada');
    }

    if (!customerId && !dto.guestEmail) {
      throw CustomError.badRequest('guestEmail es requerido para órdenes de invitado');
    }

    // Phase 1: validate all products — collect info before touching stock
    const enriched: Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
      productNameSnapshot: string;
    }> = [];

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

      enriched.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: product.retailPrice,
        productNameSnapshot: product.name,
      });
    }

    // Phase 2: reserve stock atomically, rolling back on first failure
    const reserved: Array<{ productId: string; quantity: number }> = [];

    for (const item of enriched) {
      const ok = await this.productCatalogPort.decrementStockAtomic(item.productId, item.quantity);

      if (!ok) {
        for (const r of reserved) {
          await this.productCatalogPort.incrementStock(r.productId, r.quantity);
        }
        throw CustomError.conflict(
          `Stock insuficiente para el producto "${item.productNameSnapshot}"`,
        );
      }

      reserved.push({ productId: item.productId, quantity: item.quantity });
    }

    // Phase 3: persist order — rollback all stock on DB failure
    const totalAmount = enriched.reduce(
      (sum, i) => Math.round((sum + i.unitPrice * i.quantity) * 100) / 100,
      0,
    );

    const expiryMs = EXPIRY_MINUTES[dto.paymentMethod] * 60 * 1000;
    const expiresAt = new Date(Date.now() + expiryMs);

    let order: OnlineOrderEntity;
    try {
      order = await this.onlineOrderRepository.create({
        customerId,
        guestName: dto.guestName,
        guestPhone: dto.guestPhone,
        guestEmail: dto.guestEmail,
        shippingAddress: dto.shippingAddress,
        totalAmount,
        paymentMethod: dto.paymentMethod,
        expiresAt,
        items: enriched,
      });
    } catch (err) {
      for (const r of reserved) {
        await this.productCatalogPort.incrementStock(r.productId, r.quantity);
      }
      throw err;
    }

    // Phase 4: generate payment link if ONLINE_GATEWAY
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
        // Order exists but has no payment link — let expiry handle cleanup
        throw err;
      }
    }

    return { order, paymentUrl: null };
  }
}
