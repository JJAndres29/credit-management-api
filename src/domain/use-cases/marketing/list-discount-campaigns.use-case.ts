import type { MarketingToolsRepository } from '../../repositories/marketing.repository';

export class ListDiscountCampaignsUseCase {
  constructor(private readonly marketing: MarketingToolsRepository) {}

  async execute() {
    return this.marketing.listDiscountCampaigns();
  }
}
