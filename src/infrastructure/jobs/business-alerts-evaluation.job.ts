import { EvaluateBusinessAlertsUseCase } from '../../domain/use-cases/business-alerts';
import { LoggerService } from '../../domain/services/logger.service';

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export class BusinessAlertsEvaluationJob {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly evaluateUseCase: EvaluateBusinessAlertsUseCase,
    private readonly logger?: LoggerService,
    private readonly intervalMs: number = DEFAULT_INTERVAL_MS,
  ) {}

  start(): void {
    if (this.timer) return;
    this.logger?.info('[BusinessAlertsEvaluationJob] Iniciado', { intervalMs: this.intervalMs });
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
      const { alerts } = await this.evaluateUseCase.execute();
      if (alerts.length > 0) {
        this.logger?.warn('[BusinessAlertsEvaluationJob] Alertas disparadas', { count: alerts.length });
      }
    } catch (err) {
      this.logger?.error('[BusinessAlertsEvaluationJob] Evaluación falló', err);
    } finally {
      this.running = false;
    }
  }
}
