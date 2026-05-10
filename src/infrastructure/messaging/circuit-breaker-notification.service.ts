import { NotificationService } from '../../domain/services/notification.service';
import { LoggerService } from '../../domain/services/logger.service';

type BreakerState = 'CLOSED' | 'OPEN';

export class CircuitBreakerNotificationService implements NotificationService {
  private failures = 0;
  private openedAt: number | null = null;
  private state: BreakerState = 'CLOSED';

  constructor(
    private readonly inner: NotificationService,
    private readonly opts: {
      failureThreshold: number;
      openMs: number;
      logger?: LoggerService;
    },
  ) {}

  private guard<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      const elapsed = Date.now() - (this.openedAt ?? 0);
      if (elapsed >= this.opts.openMs) {
        this.state = 'CLOSED';
        this.failures = 0;
      } else {
        this.opts.logger?.warn?.('[CircuitBreaker:WhatsApp] abierto — llamada omitida');
        return Promise.resolve(false as unknown as T);
      }
    }
    return fn().then(
      (v) => {
        if (v) this.failures = 0;
        else this.bumpFailure();
        return v;
      },
      (err) => {
        this.bumpFailure(err);
        throw err;
      },
    );
  }

  private bumpFailure(err?: unknown): void {
    this.failures += 1;
    if (this.failures >= this.opts.failureThreshold) {
      this.state = 'OPEN';
      this.openedAt = Date.now();
      this.opts.logger?.error?.('[CircuitBreaker:WhatsApp] circuito abierto', err);
    }
  }

  sendWhatsApp(to: string, message: string): Promise<boolean> {
    return this.guard(() => this.inner.sendWhatsApp(to, message));
  }

  sendTemplate(
    to: string,
    templateName: string,
    variables: string[],
    languageCode?: string,
  ): Promise<boolean> {
    return this.guard(() => this.inner.sendTemplate(to, templateName, variables, languageCode));
  }

  sendDocument(
    to: string,
    document: Buffer,
    filename: string,
    caption?: string,
    mimeType?: string,
  ): Promise<boolean> {
    return this.guard(() => this.inner.sendDocument(to, document, filename, caption, mimeType));
  }

  sendDocumentTemplate(
    to: string,
    templateName: string,
    document: Buffer,
    filename: string,
    bodyVariables: string[],
    languageCode?: string,
  ): Promise<boolean> {
    return this.guard(() =>
      this.inner.sendDocumentTemplate(to, templateName, document, filename, bodyVariables, languageCode),
    );
  }
}
