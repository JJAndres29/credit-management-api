import { Request, Response } from 'express';
import { CustomError } from '../../domain/errors';
import {
  GetCohortRetentionUseCase,
  GetCustomerLtvReportUseCase,
  GetDailySalesSummaryUseCase,
  GetDeadStockReportUseCase,
  GetInventoryTurnoverReportUseCase,
  GetProfitabilityReportUseCase,
  GetTicketAverageUseCase,
  RefreshAnalyticsReadModelsUseCase,
} from '../../domain/use-cases/analytics';
import { EvaluateBusinessAlertsUseCase } from '../../domain/use-cases/business-alerts';
import { PaginationDto } from '../../domain/dtos/shared';
import { toJsonSafe } from '../utils/json-safe';

function parseDayParam(raw: unknown, label: string): Date {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw CustomError.badRequest(`${label} debe ser YYYY-MM-DD`);
  }
  return new Date(`${raw}T00:00:00.000Z`);
}

export class AdminAnalyticsController {
  constructor(
    private readonly refreshReadModels: RefreshAnalyticsReadModelsUseCase,
    private readonly dailySales: GetDailySalesSummaryUseCase,
    private readonly profitability: GetProfitabilityReportUseCase,
    private readonly deadStock: GetDeadStockReportUseCase,
    private readonly inventoryTurnover: GetInventoryTurnoverReportUseCase,
    private readonly cohorts: GetCohortRetentionUseCase,
    private readonly ltv: GetCustomerLtvReportUseCase,
    private readonly ticketAvg: GetTicketAverageUseCase,
    private readonly evaluateAlerts: EvaluateBusinessAlertsUseCase,
  ) {}

  refreshMaterializedViews = async (_req: Request, res: Response): Promise<void> => {
    try {
      await this.refreshReadModels.execute();
      res.json({ ok: true });
    } catch (err) {
      this.handleError(err, res);
    }
  };

  getDailySales = async (req: Request, res: Response): Promise<void> => {
    try {
      const fromDay = parseDayParam(req.query.from, 'from');
      const toDay = parseDayParam(req.query.to, 'to');
      if (fromDay > toDay) {
        res.status(400).json({ error: 'from no puede ser posterior a to' });
        return;
      }
      const rows = await this.dailySales.execute({ fromDay, toDay });
      res.json(toJsonSafe({ data: rows }));
    } catch (err) {
      this.handleError(err, res);
    }
  };

  getProfitability = async (req: Request, res: Response): Promise<void> => {
    const [pErr, pagination] = PaginationDto.create(req.query as Record<string, unknown>);
    if (pErr) {
      res.status(400).json({ error: pErr });
      return;
    }
    try {
      const rows = await this.profitability.execute({
        limit: pagination!.limit,
        offset: pagination!.skip,
      });
      res.json(toJsonSafe({ data: rows }));
    } catch (err) {
      this.handleError(err, res);
    }
  };

  getDeadStock = async (req: Request, res: Response): Promise<void> => {
    const lim = Number(req.query.limit ?? 50);
    if (!Number.isFinite(lim) || lim < 1 || lim > 500) {
      res.status(400).json({ error: 'limit entre 1 y 500' });
      return;
    }
    try {
      const rows = await this.deadStock.execute({ limit: lim });
      res.json(toJsonSafe({ data: rows }));
    } catch (err) {
      this.handleError(err, res);
    }
  };

  getInventoryTurnover = async (req: Request, res: Response): Promise<void> => {
    const [pErr, pagination] = PaginationDto.create(req.query as Record<string, unknown>);
    if (pErr) {
      res.status(400).json({ error: pErr });
      return;
    }
    try {
      const rows = await this.inventoryTurnover.execute({
        limit: pagination!.limit,
        offset: pagination!.skip,
      });
      res.json(toJsonSafe({ data: rows }));
    } catch (err) {
      this.handleError(err, res);
    }
  };

  getCohorts = async (_req: Request, res: Response): Promise<void> => {
    try {
      const rows = await this.cohorts.execute();
      res.json(toJsonSafe({ data: rows }));
    } catch (err) {
      this.handleError(err, res);
    }
  };

  getCustomerLtv = async (req: Request, res: Response): Promise<void> => {
    const [pErr, pagination] = PaginationDto.create(req.query as Record<string, unknown>);
    if (pErr) {
      res.status(400).json({ error: pErr });
      return;
    }
    try {
      const rows = await this.ltv.execute({
        limit: pagination!.limit,
        offset: pagination!.skip,
      });
      res.json(toJsonSafe({ data: rows }));
    } catch (err) {
      this.handleError(err, res);
    }
  };

  getTicketAverage = async (req: Request, res: Response): Promise<void> => {
    try {
      const fromDay = parseDayParam(req.query.from, 'from');
      const toDay = parseDayParam(req.query.to, 'to');
      if (fromDay > toDay) {
        res.status(400).json({ error: 'from no puede ser posterior a to' });
        return;
      }
      const channelRaw = req.query.channel;
      const channel =
        channelRaw === 'ONLINE' || channelRaw === 'PHYSICAL' ? channelRaw : undefined;
      const result = await this.ticketAvg.execute({ fromDay, toDay, channel });
      res.json(toJsonSafe(result));
    } catch (err) {
      this.handleError(err, res);
    }
  };

  evaluateBusinessAlerts = async (_req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.evaluateAlerts.execute();
      res.json(toJsonSafe(result));
    } catch (err) {
      this.handleError(err, res);
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
