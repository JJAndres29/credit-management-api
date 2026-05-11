import type { AnalyticsReadModelPort } from '../../services/analytics-read-model.port';

export class RefreshAnalyticsReadModelsUseCase {
  constructor(private readonly readModels: AnalyticsReadModelPort) {}

  async execute(): Promise<void> {
    await this.readModels.refreshAllMaterializedViews();
  }
}
