import type { AnalyticsReadModelPort } from '../../services/analytics-read-model.port';

export class GetCohortRetentionUseCase {
  constructor(private readonly readModels: AnalyticsReadModelPort) {}

  async execute() {
    return this.readModels.getCustomerCohorts();
  }
}
