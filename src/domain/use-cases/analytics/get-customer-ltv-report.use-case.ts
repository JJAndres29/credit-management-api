import type { AnalyticsReadModelPort } from '../../services/analytics-read-model.port';

export class GetCustomerLtvReportUseCase {
  constructor(private readonly readModels: AnalyticsReadModelPort) {}

  async execute(params: { limit: number; offset: number }) {
    return this.readModels.getCustomerLifetimeValues(params);
  }
}
