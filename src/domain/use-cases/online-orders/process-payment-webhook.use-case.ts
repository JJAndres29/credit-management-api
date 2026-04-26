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

    const exists = await this.orderRepository.webhookExists(provider, eventId);
    if (exists) return 'already_processed';

    const { status, amount, externalReference } =
      await this.paymentGateway.verifyTransaction(paymentId);

    const order = await this.orderRepository.findById(externalReference);

    if (!order) {
      await this.orderRepository.saveProcessedWebhook({ provider, eventId });
      return 'order_not_found';
    }

    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      await this.orderRepository.saveProcessedWebhook({ provider, eventId });
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
        await this.orderRepository.saveProcessedWebhook({ provider, eventId });
        return 'amount_mismatch';
      }
      await this.orderRepository.markAsPaid(order.id, { provider, eventId });
      return 'paid';
    }

    // DECLINED
    await this.orderRepository.markAsCancelled(order.id, { provider, eventId });
    for (const item of order.items) {
      await this.productCatalogPort.incrementStock(item.productId, item.quantity);
    }
    return 'cancelled';
  }
}
