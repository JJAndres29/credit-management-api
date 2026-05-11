export interface DiscountCampaignCreateData {
  name: string;
  categoryId: string | null;
  percentOff: number;
  startsAt: Date;
  endsAt: Date;
}

export interface PriceExperimentCreateData {
  productId: string;
  name: string;
  cohortKey: string | null;
  priceA: number;
  priceB: number;
  startAt: Date;
  endAt: Date;
  winnerCriteria: 'REVENUE' | 'CONVERSION_RATE';
}

export interface DiscountCampaignRow {
  id: string;
  name: string;
  categoryId: string | null;
  percentOff: string;
  startsAt: Date;
  endsAt: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PriceExperimentRow {
  id: string;
  productId: string;
  name: string;
  cohortKey: string | null;
  priceA: string;
  priceB: string;
  startAt: Date;
  endAt: Date;
  winnerCriteria: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MarketingToolsDatasource {
  createDiscountCampaign(data: DiscountCampaignCreateData): Promise<DiscountCampaignRow>;
  listDiscountCampaigns(): Promise<DiscountCampaignRow[]>;
  createPriceExperiment(data: PriceExperimentCreateData): Promise<PriceExperimentRow>;
  listPriceExperiments(): Promise<PriceExperimentRow[]>;
}
