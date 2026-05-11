import type { AnalyticsReadModelPort } from '../../services/analytics-read-model.port';

export class GetInventoryTurnoverReportUseCase {
  constructor(private readonly readModels: AnalyticsReadModelPort) {}

  async execute(params: { limit: number; offset: number }) {
    return this.readModels.getInventoryTurnover(params);
  }
}
