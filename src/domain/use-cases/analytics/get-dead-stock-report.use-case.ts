import type { AnalyticsReadModelPort } from '../../services/analytics-read-model.port';

export class GetDeadStockReportUseCase {
  constructor(private readonly readModels: AnalyticsReadModelPort) {}

  async execute(params: { limit: number }) {
    return this.readModels.getDeadStockCandidates(params);
  }
}
