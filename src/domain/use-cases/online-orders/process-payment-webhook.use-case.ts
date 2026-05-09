import { OnlineOrderRepository } from '../../repositories/online-order.repository';
import { IPaymentGateway } from '../../services/payment-gateway.port';
import { ProductCatalogPort } from '../../services/product-catalog.port';
import { OrderStatus } from '../../entities/online-order.entity';

export type WebhookProcessResult =
  | 'ignored'
  | 'already_processed'
  | 'paid'
  | 'amount_mismatch'
  | 'cancelled'
  | 'pending'
  | 'order_not_found'
  | 'order_not_pending';

export type WebhookInput = {
  provider: string;
  eventId: string;
  paymentId: string;
};

export class ProcessPaymentWebhookUseCase {
  constructor(
    private readonly orderRepository: OnlineOrderRepository,
    private readonly paymentGateway: IPaymentGateway,
    private readonly productCatalogPort: ProductCatalogPort,
  ) {}

  async execute(input: WebhookInput): Promise<WebhookProcessResult> {
    const { provider, eventId, paymentId } = input;

    if (!paymentId) return 'ignored';

    const claimed = await this.orderRepository.tryClaimProcessedWebhook({ provider, eventId });
    if (!claimed) return 'already_processed';

    let status: Awaited<ReturnType<IPaymentGateway['verifyTransaction']>>['status'];
    let amount: number;
    let externalReference: string;

    try {
      const v = await this.paymentGateway.verifyTransaction(paymentId);
      status = v.status;
      amount = v.amount;
      externalReference = v.externalReference;
    } catch (err) {
      await this.orderRepository.releaseProcessedWebhookClaim({ provider, eventId });
      throw err;
    }

    const order = await this.orderRepository.findById(externalReference);

    if (!order) {
      return 'order_not_found';
    }

    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      return 'order_not_pending';
    }

    if (status === 'PENDING') {
      return 'pending';
    }

    if (status === 'APPROVED') {
      const diff = Math.abs(amount - order.totalAmount);
      if (diff > 1) {
        console.error('[ProcessWebhook] CRITICAL amount mismatch', {
          paymentId,
          orderId: order.id,
          expected: order.totalAmount,
          received: amount,
        });
        return 'amount_mismatch';
      }
      await this.orderRepository.markAsPaid(order.id, { provider, eventId });
      return 'paid';
    }

    await this.orderRepository.markAsCancelled(order.id, { provider, eventId });
    let allRestored = true;
    for (const item of order.items) {
      try {
        await this.productCatalogPort.incrementStock(item.productId, item.quantity);
      } catch (err) {
        allRestored = false;
        console.error('[ProcessWebhook] Falló incrementStock', {
          orderId: order.id,
          productId: item.productId,
          quantity: item.quantity,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    if (allRestored) {
      await this.orderRepository.markStockRestored(order.id);
    }
    return 'cancelled';
  }
}
