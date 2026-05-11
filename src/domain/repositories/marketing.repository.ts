import type {
  DiscountCampaignCreateData,
  DiscountCampaignRow,
  PriceExperimentCreateData,
  PriceExperimentRow,
} from '../datasources/marketing.datasource';

export interface MarketingToolsRepository {
  createDiscountCampaign(data: DiscountCampaignCreateData): Promise<DiscountCampaignRow>;
  listDiscountCampaigns(): Promise<DiscountCampaignRow[]>;
  createPriceExperiment(data: PriceExperimentCreateData): Promise<PriceExperimentRow>;
  listPriceExperiments(): Promise<PriceExperimentRow[]>;
}
