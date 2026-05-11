import type { AnalyticsReadModelPort } from '../../services/analytics-read-model.port';

export type RotationAlertItem = {
  productId: string;
  productName: string;
  stock: number;
  lastSaleAt: string | null;
  productUpdatedAt: string;
  reason: string;
};

/**
 * Combina inventario muerto (MV) con umbral de stock y antigüedad de actualización del catálogo.
 */
export class GetRotationAlertsUseCase {
  constructor(private readonly readModels: AnalyticsReadModelPort) {}

  async execute(params: { minStock: number; staleDays: number; limit: number }): Promise<RotationAlertItem[]> {
    const candidates = await this.readModels.getDeadStockCandidates({ limit: params.limit * 3 });
    const cutoff = Date.now() - params.staleDays * 24 * 60 * 60 * 1000;
    const out: RotationAlertItem[] = [];
    for (const row of candidates) {
      const stockNum = Number(row.stock);
      if (stockNum < params.minStock) continue;
      const updated = new Date(row.productUpdatedAt).getTime();
      if (updated > cutoff) continue;
      out.push({
        productId: row.productId,
        productName: row.productName,
        stock: stockNum,
        lastSaleAt: row.lastSaleAt ? new Date(row.lastSaleAt).toISOString() : null,
        productUpdatedAt: new Date(row.productUpdatedAt).toISOString(),
        reason: `Sin ventas recientes (MV 90d) y stock>=${params.minStock}; catálogo sin editar ${params.staleDays}+ días`,
      });
      if (out.length >= params.limit) break;
    }
    return out;
  }
}
