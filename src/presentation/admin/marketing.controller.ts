import { Request, Response } from 'express';
import { CustomError } from '../../domain/errors';
import { CreateDiscountCampaignDto, CreatePriceExperimentDto } from '../../domain/dtos/marketing';
import {
  CreateDiscountCampaignUseCase,
  CreatePriceExperimentUseCase,
  GetRotationAlertsUseCase,
  ListDiscountCampaignsUseCase,
  ListPriceExperimentsUseCase,
} from '../../domain/use-cases/marketing';
import { toJsonSafe } from '../utils/json-safe';

export class AdminMarketingController {
  constructor(
    private readonly createCampaign: CreateDiscountCampaignUseCase,
    private readonly listCampaigns: ListDiscountCampaignsUseCase,
    private readonly createExperiment: CreatePriceExperimentUseCase,
    private readonly listExperiments: ListPriceExperimentsUseCase,
    private readonly rotation: GetRotationAlertsUseCase,
  ) {}

  postDiscountCampaign = async (req: Request, res: Response): Promise<void> => {
    const [err, dto] = CreateDiscountCampaignDto.create(req.body as Record<string, unknown>);
    if (err) {
      res.status(400).json({ error: err });
      return;
    }
    try {
      const row = await this.createCampaign.execute(dto!);
      res.status(201).json(toJsonSafe(row));
    } catch (e) {
      this.handleError(e, res);
    }
  };

  getDiscountCampaigns = async (_req: Request, res: Response): Promise<void> => {
    try {
      const rows = await this.listCampaigns.execute();
      res.json(toJsonSafe({ data: rows }));
    } catch (e) {
      this.handleError(e, res);
    }
  };

  postPriceExperiment = async (req: Request, res: Response): Promise<void> => {
    const [err, dto] = CreatePriceExperimentDto.create(req.body as Record<string, unknown>);
    if (err) {
      res.status(400).json({ error: err });
      return;
    }
    try {
      const row = await this.createExperiment.execute(dto!);
      res.status(201).json(toJsonSafe(row));
    } catch (e) {
      this.handleError(e, res);
    }
  };

  getPriceExperiments = async (_req: Request, res: Response): Promise<void> => {
    try {
      const rows = await this.listExperiments.execute();
      res.json(toJsonSafe({ data: rows }));
    } catch (e) {
      this.handleError(e, res);
    }
  };

  getRotationAlerts = async (req: Request, res: Response): Promise<void> => {
    const minStock = Number(req.query.minStock ?? 10);
    const staleDays = Number(req.query.staleDays ?? 60);
    const limit = Number(req.query.limit ?? 50);
    if (!Number.isFinite(minStock) || minStock < 0) {
      res.status(400).json({ error: 'minStock inválido' });
      return;
    }
    if (!Number.isFinite(staleDays) || staleDays < 1) {
      res.status(400).json({ error: 'staleDays inválido' });
      return;
    }
    if (!Number.isFinite(limit) || limit < 1 || limit > 200) {
      res.status(400).json({ error: 'limit entre 1 y 200' });
      return;
    }
    try {
      const data = await this.rotation.execute({ minStock, staleDays, limit });
      res.json({ data });
    } catch (e) {
      this.handleError(e, res);
    }
  };

  private handleError(error: unknown, res: Response): void {
    if (error instanceof CustomError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}
