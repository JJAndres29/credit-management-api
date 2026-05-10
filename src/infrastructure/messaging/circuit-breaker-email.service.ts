import { EmailService, SendEmailOptions } from '../../domain/services/email.service';
import { LoggerService } from '../../domain/services/logger.service';

type BreakerState = 'CLOSED' | 'OPEN';

/** Minimal breaker (P3): opens after N failures, resets after cooldown — swap for opossum later if needed. */
export class CircuitBreakerEmailService implements EmailService {
  private failures = 0;
  private openedAt: number | null = null;
  private state: BreakerState = 'CLOSED';

  constructor(
    private readonly inner: EmailService,
    private readonly opts: {
      failureThreshold: number;
      openMs: number;
      logger?: LoggerService;
      serviceLabel?: string;
    },
  ) {}

  async sendEmail(options: SendEmailOptions): Promise<boolean> {
    const label = this.opts.serviceLabel ?? 'Email';
    if (this.state === 'OPEN') {
      const elapsed = Date.now() - (this.openedAt ?? 0);
      if (elapsed >= this.opts.openMs) {
        this.state = 'CLOSED';
        this.failures = 0;
        this.opts.logger?.warn?.(`[CircuitBreaker:${label}] half-open — reintentando`);
      } else {
        this.opts.logger?.warn?.(`[CircuitBreaker:${label}] abierto — omitiendo envío`);
        return false;
      }
    }

    try {
      const ok = await this.inner.sendEmail(options);
      if (ok) this.failures = 0;
      else this.onFailure(label);
      return ok;
    } catch (err) {
      this.onFailure(label, err);
      return false;
    }
  }

  private onFailure(label: string, err?: unknown): void {
    this.failures += 1;
    if (this.failures >= this.opts.failureThreshold) {
      this.state = 'OPEN';
      this.openedAt = Date.now();
      this.opts.logger?.error?.(`[CircuitBreaker:${label}] abierto tras ${this.failures} fallos`, err);
    }
  }
}
