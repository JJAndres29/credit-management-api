import type { AnalyticsReadModelPort } from '../../services/analytics-read-model.port';

export class GetDailySalesSummaryUseCase {
  constructor(private readonly readModels: AnalyticsReadModelPort) {}

  async execute(params: { fromDay: Date; toDay: Date }) {
    return this.readModels.getDailySalesSummary(params);
  }
}
