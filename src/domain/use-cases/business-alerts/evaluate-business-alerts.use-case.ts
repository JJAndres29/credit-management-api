import { BUSINESS_ALERT_TRIGGERED, type BusinessAlertTriggeredData } from '../../events';
import type { EventEmitterPort } from '../../events/event-emitter';
import type { AnalyticsReadModelPort } from '../../services/analytics-read-model.port';
import type { BusinessMetricsSnapshotPort } from '../../services/business-metrics-snapshot.port';

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export class EvaluateBusinessAlertsUseCase {
  constructor(
    private readonly readModels: AnalyticsReadModelPort,
    private readonly metrics: BusinessMetricsSnapshotPort,
    private readonly eventEmitter?: EventEmitterPort,
  ) {}

  /**
   * Reglas iniciales (ajustables): caída de pagos online 24h, caída de revenue ONLINE en MV, spike de expiraciones.
   */
  async execute(): Promise<{ alerts: BusinessAlertTriggeredData[] }> {
    const alerts: BusinessAlertTriggeredData[] = [];
    const snap = await this.metrics.loadSnapshot();

    const today = startOfUtcDay(new Date());
    const y = addDays(today, -1);
    const y2 = addDays(today, -2);

    const [revY, revY2] = await Promise.all([
      this.readModels.getOnlineRevenueForDay(y),
      this.readModels.getOnlineRevenueForDay(y2),
    ]);

    const revYn = revY !== null ? Number(revY) : 0;
    const revY2n = revY2 !== null ? Number(revY2) : 0;

    if (revY2n > 0 && revYn < revY2n * 0.8) {
      alerts.push({
        code: 'ONLINE_REVENUE_DROP',
        severity: 'WARN',
        message: 'Ingresos ONLINE (MV) ayer cayeron >20% vs el día anterior',
        details: { revYesterday: revYn, revPrev: revY2n },
      });
    }

    const paidPrev = snap.paidOnlineOrdersPrev24h;
    const paidLast = snap.paidOnlineOrdersLast24h;
    if (paidPrev > 5 && paidLast < paidPrev * 0.8) {
      alerts.push({
        code: 'ONLINE_PAID_ORDERS_DROP',
        severity: 'WARN',
        message: 'Órdenes pagadas (ventana 24h) cayeron >20% vs la ventana previa',
        details: { paidLast24h: paidLast, paidPrev24h: paidPrev },
      });
    }

    const exp = snap.expiredOrdersLast24h;
    const avg = snap.expiredOrdersAvgPerDay7d;
    if (avg > 0 && exp > avg * 1.5 && exp >= 3) {
      alerts.push({
        code: 'EXPIRED_ORDERS_SPIKE',
        severity: 'WARN',
        message: 'Eventos EXPIRED en 24h superan 1.5× el promedio diario de 7 días',
        details: { expired24h: exp, avgPerDay7d: avg },
      });
    }

    for (const a of alerts) {
      this.eventEmitter?.emit(BUSINESS_ALERT_TRIGGERED, a);
    }

    return { alerts };
  }
}
