import { PriceExperimentWinnerCriteria } from '@prisma/client';
import { prisma } from '../../config/prisma';
import type {
  DiscountCampaignCreateData,
  DiscountCampaignRow,
  MarketingToolsDatasource,
  PriceExperimentCreateData,
  PriceExperimentRow,
} from '../../domain/datasources/marketing.datasource';

function mapCampaign(r: {
  id: string;
  name: string;
  categoryId: string | null;
  percentOff: { toString(): string };
  startsAt: Date;
  endsAt: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): DiscountCampaignRow {
  return {
    id: r.id,
    name: r.name,
    categoryId: r.categoryId,
    percentOff: r.percentOff.toString(),
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    isActive: r.isActive,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function mapExperiment(r: {
  id: string;
  productId: string;
  name: string;
  cohortKey: string | null;
  priceA: { toString(): string };
  priceB: { toString(): string };
  startAt: Date;
  endAt: Date;
  winnerCriteria: PriceExperimentWinnerCriteria;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): PriceExperimentRow {
  return {
    id: r.id,
    productId: r.productId,
    name: r.name,
    cohortKey: r.cohortKey,
    priceA: r.priceA.toString(),
    priceB: r.priceB.toString(),
    startAt: r.startAt,
    endAt: r.endAt,
    winnerCriteria: r.winnerCriteria,
    isActive: r.isActive,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export class PrismaMarketingToolsDatasource implements MarketingToolsDatasource {
  async createDiscountCampaign(data: DiscountCampaignCreateData): Promise<DiscountCampaignRow> {
    const row = await prisma.discountCampaign.create({
      data: {
        name: data.name,
        categoryId: data.categoryId,
        percentOff: data.percentOff,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
      },
    });
    return mapCampaign(row);
  }

  async listDiscountCampaigns(): Promise<DiscountCampaignRow[]> {
    const rows = await prisma.discountCampaign.findMany({ orderBy: { startsAt: 'desc' } });
    return rows.map(mapCampaign);
  }

  async createPriceExperiment(data: PriceExperimentCreateData): Promise<PriceExperimentRow> {
    const wc =
      data.winnerCriteria === 'CONVERSION_RATE'
        ? PriceExperimentWinnerCriteria.CONVERSION_RATE
        : PriceExperimentWinnerCriteria.REVENUE;

    const row = await prisma.priceExperiment.create({
      data: {
        productId: data.productId,
        name: data.name,
        cohortKey: data.cohortKey,
        priceA: data.priceA,
        priceB: data.priceB,
        startAt: data.startAt,
        endAt: data.endAt,
        winnerCriteria: wc,
      },
    });
    return mapExperiment(row);
  }

  async listPriceExperiments(): Promise<PriceExperimentRow[]> {
    const rows = await prisma.priceExperiment.findMany({ orderBy: { startAt: 'desc' } });
    return rows.map(mapExperiment);
  }
}
