import { OnlineOrderRepository } from '../../repositories/online-order.repository';
import { ProductCatalogPort } from '../../services/product-catalog.port';

export interface ExpireOnlineOrdersResult {
  scanned: number;
  expired: number;
  skipped: number;
  errors: number;
}

/**
 * Sweeps PENDING_PAYMENT orders whose `expiresAt` has passed, marks them as
 * EXPIRED and returns their reserved stock to inventory.
 *
 * Idempotent and race-safe: relies on `tryCancelOrExpirePending`'s atomic
 * status guard so a webhook arriving concurrently with PAID always wins —
 * in that case the order is reported as `skipped` and stock is NOT restored
 * (it has already been consumed by the sale).
 */
export class ExpireOnlineOrdersUseCase {
  constructor(
    private readonly orderRepository: OnlineOrderRepository,
    private readonly productCatalogPort: ProductCatalogPort,
  ) {}

  async execute(now: Date = new Date(), batchSize: number = 100): Promise<ExpireOnlineOrdersResult> {
    const candidates = await this.orderRepository.findExpiredPending(now, batchSize);

    let expired = 0;
    let skipped = 0;
    let errors = 0;

    for (const order of candidates) {
      try {
        const transitioned = await this.orderRepository.tryCancelOrExpirePending(
          order.id,
          'EXPIRED',
        );
        if (!transitioned) {
          skipped++;
          continue;
        }

        let allRestored = true;
        for (const item of transitioned.items) {
          try {
            await this.productCatalogPort.incrementStock(item.productId, item.quantity);
          } catch (err) {
            allRestored = false;
            errors++;
            console.error('[ExpireOnlineOrders] Falló incrementStock', {
              orderId: transitioned.id,
              productId: item.productId,
              quantity: item.quantity,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }

        if (allRestored) {
          await this.orderRepository.markStockRestored(transitioned.id);
        }
        expired++;
      } catch (err) {
        errors++;
        console.error('[ExpireOnlineOrders] Falló al expirar orden', {
          orderId: order.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { scanned: candidates.length, expired, skipped, errors };
  }
}
