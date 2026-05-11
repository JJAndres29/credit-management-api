import type { MarketingToolsDatasource } from '../../domain/datasources/marketing.datasource';
import type { MarketingToolsRepository } from '../../domain/repositories/marketing.repository';

export class MarketingToolsRepositoryImpl implements MarketingToolsRepository {
  constructor(private readonly datasource: MarketingToolsDatasource) {}

  createDiscountCampaign: MarketingToolsRepository['createDiscountCampaign'] = (data) =>
    this.datasource.createDiscountCampaign(data);

  listDiscountCampaigns: MarketingToolsRepository['listDiscountCampaigns'] = () =>
    this.datasource.listDiscountCampaigns();

  createPriceExperiment: MarketingToolsRepository['createPriceExperiment'] = (data) =>
    this.datasource.createPriceExperiment(data);

  listPriceExperiments: MarketingToolsRepository['listPriceExperiments'] = () =>
    this.datasource.listPriceExperiments();
}
