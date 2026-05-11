import { prisma } from '../../config/prisma';
import type {
  BusinessMetricsSnapshot,
  BusinessMetricsSnapshotPort,
} from '../../domain/services/business-metrics-snapshot.port';

export class PrismaBusinessMetricsSnapshotDatasource implements BusinessMetricsSnapshotPort {
  async loadSnapshot(): Promise<BusinessMetricsSnapshot> {
    const rows = await prisma.$queryRaw<
      {
        paid_last24: bigint;
        paid_prev24: bigint;
        expired_last24: bigint;
        expired_week: bigint;
      }[]
    >`
      SELECT
        (
          SELECT COUNT(*)::bigint
          FROM "OnlineOrder" o
          WHERE o.status = 'PAID'
            AND COALESCE(o."paidAt", o."createdAt") >= NOW() - INTERVAL '24 hours'
        ) AS paid_last24,
        (
          SELECT COUNT(*)::bigint
          FROM "OnlineOrder" o
          WHERE o.status = 'PAID'
            AND COALESCE(o."paidAt", o."createdAt") >= NOW() - INTERVAL '48 hours'
            AND COALESCE(o."paidAt", o."createdAt") < NOW() - INTERVAL '24 hours'
        ) AS paid_prev24,
        (
          SELECT COUNT(*)::bigint
          FROM "OrderEvent" e
          WHERE e."toStatus" = 'EXPIRED'::"OrderStatus"
            AND e."createdAt" >= NOW() - INTERVAL '24 hours'
        ) AS expired_last24,
        (
          SELECT COUNT(*)::bigint
          FROM "OrderEvent" e
          WHERE e."toStatus" = 'EXPIRED'::"OrderStatus"
            AND e."createdAt" >= NOW() - INTERVAL '7 days'
        ) AS expired_week
    `;

    const r = rows[0];
    if (!r) {
      return {
        paidOnlineOrdersLast24h: 0,
        paidOnlineOrdersPrev24h: 0,
        expiredOrdersLast24h: 0,
        expiredOrdersAvgPerDay7d: 0,
      };
    }

    const expiredAvg7d = Number(r.expired_week) / 7;

    return {
      paidOnlineOrdersLast24h: Number(r.paid_last24),
      paidOnlineOrdersPrev24h: Number(r.paid_prev24),
      expiredOrdersLast24h: Number(r.expired_last24),
      expiredOrdersAvgPerDay7d: expiredAvg7d,
    };
  }
}
