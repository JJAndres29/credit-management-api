import type { MarketingToolsRepository } from '../../repositories/marketing.repository';

export class ListPriceExperimentsUseCase {
  constructor(private readonly marketing: MarketingToolsRepository) {}

  async execute() {
    return this.marketing.listPriceExperiments();
  }
}
