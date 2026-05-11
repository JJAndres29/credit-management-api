/**
 * P5 — Minimal operational probes for business alerting (small scoped queries).
 * Separate from `AnalyticsReadModelPort` so analytics stays MV-only.
 */

export interface BusinessMetricsSnapshot {
  paidOnlineOrdersLast24h: number;
  paidOnlineOrdersPrev24h: number;
  expiredOrdersLast24h: number;
  expiredOrdersAvgPerDay7d: number;
}

export interface BusinessMetricsSnapshotPort {
  loadSnapshot(): Promise<BusinessMetricsSnapshot>;
}
