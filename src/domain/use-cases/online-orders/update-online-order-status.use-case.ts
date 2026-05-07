import { OnlineOrderRepository } from '../../repositories/online-order.repository';
import { SaleRepository } from '../../repositories/sale.repository';
import { CustomerLinkPort } from '../../services/customer-link.port';
import { ProductCatalogPort } from '../../services/product-catalog.port';
import { OnlineOrderEntity, OrderStatus } from '../../entities/online-order.entity';
import { CustomError } from '../../errors';
import { UpdateOnlineOrderStatusDto } from '../../dtos/online-orders/update-online-order-status.dto';
import { SaleType } from '../../entities';

export class UpdateOnlineOrderStatusUseCase {
  constructor(
    private readonly orderRepository: OnlineOrderRepository,
    private readonly saleRepository?: SaleRepository,
    private readonly customerLink?: CustomerLinkPort,
    private readonly productCatalogPort?: ProductCatalogPort,
  ) {}

  async execute(id: string, dto: UpdateOnlineOrderStatusDto): Promise<OnlineOrderEntity> {
    const order = await this.orderRepository.findById(id);
    if (!order) throw CustomError.notFound('Order not found');

    // CANCELLED / EXPIRED on a still-pending order: atomic transition + stock restore.
    // The status guard inside `tryCancelOrExpirePending` protects against a race
    // with the webhook handler that may concurrently mark the order as PAID.
    if (
      (dto.status === 'CANCELLED' || dto.status === 'EXPIRED') &&
      order.status === OrderStatus.PENDING_PAYMENT
    ) {
      const cancelled = await this.orderRepository.tryCancelOrExpirePending(id, dto.status);

      if (!cancelled) {
        // Status changed under us (most likely PAID via webhook). Reload and return
        // the fresh entity so the admin sees the actual current state.
        const fresh = await this.orderRepository.findById(id);
        return fresh ?? order;
      }

      if (this.productCatalogPort) {
        await this.restoreStock(cancelled);
      }

      return cancelled;
    }

    // CANCELLED / EXPIRED requested on an already terminal order: idempotent.
    // No stock movement (it was either already restored or never reserved).
    if (
      (dto.status === 'CANCELLED' || dto.status === 'EXPIRED') &&
      order.status !== OrderStatus.PENDING_PAYMENT
    ) {
      if (order.status === dto.status) return order;
      // Cross-transitions (e.g. PAID → CANCELLED) are out of scope here:
      // they belong to a refund workflow with audit + balance adjustments.
      throw CustomError.badRequest(
        `No se puede transicionar de ${order.status} a ${dto.status} desde este endpoint`,
      );
    }

    const updated = await this.orderRepository.updateStatus(id, dto.status);

    if (dto.status === 'PAID' && this.saleRepository && this.customerLink) {
      await this.createSaleFromOrder(order);
    }

    return updated;
  }

  private async restoreStock(order: OnlineOrderEntity): Promise<void> {
    // Best-effort: if some increments fail we still mark the marker so the
    // remediation script doesn't double-restore. The admin can audit via logs.
    let allOk = true;
    for (const item of order.items) {
      try {
        await this.productCatalogPort!.incrementStock(item.productId, item.quantity);
      } catch (err) {
        allOk = false;
        console.error('[UpdateOnlineOrderStatus] Falló incrementStock', {
          orderId: order.id,
          productId: item.productId,
          quantity: item.quantity,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    if (allOk) {
      try {
        await this.orderRepository.markStockRestored(order.id);
      } catch {
        /* marker is best-effort */
      }
    }
  }

  private async createSaleFromOrder(order: OnlineOrderEntity): Promise<void> {
    if (!order.customerId) return; // guest orders: no Sale
    const clientId = await this.customerLink!.findClientIdByCustomerId(order.customerId);
    if (!clientId) return; // customer not linked to a Client

    try {
      await this.saleRepository!.create({
        clientId,
        type: SaleType.CASH,
        total: order.totalAmount,
        items: order.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.quantity * item.unitPrice,
          basePrice: item.unitPrice,
          appliedRule: null,
          newProduct: undefined,
        })),
        skipStockDecrement: true,
        auditLog: undefined,
      });
    } catch {
      // Sale creation is a best-effort side-effect; never block the status update
    }
  }
}
