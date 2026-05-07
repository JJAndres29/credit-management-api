import { ExpireOnlineOrdersUseCase } from '../../domain/use-cases/online-orders';
import { LoggerService } from '../../domain/services/logger.service';

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_BATCH_SIZE = 100;

/**
 * In-process scheduled task that periodically expires unpaid online orders
 * and returns their reserved stock to inventory.
 *
 * Single-instance assumption: if the deployment scales horizontally, multiple
 * processes will each run their own ticker. Concurrency is safe because
 * `ExpireOnlineOrdersUseCase` uses an atomic status guard
 * (`tryCancelOrExpirePending`) — duplicate processing is rejected as `skipped`.
 *
 * Failure mode: if the database is briefly down, errors are logged and the
 * next tick will retry. The job never throws into the event loop.
 */
export class OnlineOrderExpiryJob {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly expireUseCase: ExpireOnlineOrdersUseCase,
    private readonly logger?: LoggerService,
    private readonly intervalMs: number = DEFAULT_INTERVAL_MS,
    private readonly batchSize: number = DEFAULT_BATCH_SIZE,
  ) {}

  start(): void {
    if (this.timer) return;

    this.logger?.info('[OnlineOrderExpiryJob] Iniciado', {
      intervalMs: this.intervalMs,
      batchSize: this.batchSize,
    });

    // Fire once on startup so any orders that expired during downtime get
    // cleaned up immediately instead of waiting `intervalMs`.
    void this.tick();
    this.timer = setInterval(() => void this.tick(), this.intervalMs);

    // Allow the Node.js process to exit even while this interval is alive
    // (e.g. during tests or graceful shutdown).
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    // Re-entrancy guard: skip the new tick if the previous one is still
    // running (slow DB, large batch). Prevents stacking concurrent sweeps.
    if (this.running) return;
    this.running = true;

    try {
      const result = await this.expireUseCase.execute(new Date(), this.batchSize);
      if (result.scanned > 0) {
        this.logger?.info('[OnlineOrderExpiryJob] Tick completado', { ...result });
      }
    } catch (err) {
      this.logger?.error('[OnlineOrderExpiryJob] Tick falló', err);
    } finally {
      this.running = false;
    }
  }
}
