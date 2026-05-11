import { RefreshAnalyticsReadModelsUseCase } from '../../domain/use-cases/analytics';
import { LoggerService } from '../../domain/services/logger.service';

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export class AnalyticsReadModelsRefreshJob {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly refreshUseCase: RefreshAnalyticsReadModelsUseCase,
    private readonly logger?: LoggerService,
    private readonly intervalMs: number = DEFAULT_INTERVAL_MS,
  ) {}

  start(): void {
    if (this.timer) return;
    this.logger?.info('[AnalyticsReadModelsRefreshJob] Iniciado', { intervalMs: this.intervalMs });
    void this.tick();
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.refreshUseCase.execute();
      this.logger?.info('[AnalyticsReadModelsRefreshJob] Vistas materializadas actualizadas');
    } catch (err) {
      this.logger?.error('[AnalyticsReadModelsRefreshJob] Falló refresh', err);
    } finally {
      this.running = false;
    }
  }
}
