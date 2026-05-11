import type { AnalyticsReadModelPort } from '../../services/analytics-read-model.port';

export class GetTicketAverageUseCase {
  constructor(private readonly readModels: AnalyticsReadModelPort) {}

  async execute(params: { fromDay: Date; toDay: Date; channel?: string }) {
    const avg = await this.readModels.getAverageTicket(params);
    return { avgTicket: avg };
  }
}
