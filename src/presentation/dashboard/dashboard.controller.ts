import { Request, Response } from 'express';
import { CustomError } from '../../domain/errors';
import { GetDashboardUseCase } from '../../domain/use-cases/dashboard';
import { GetMonthlySummaryUseCase } from '../../domain/use-cases/dashboard/get-monthly-summary.use-case';

export class DashboardController {
  constructor(
    private readonly getDashboardUseCase: GetDashboardUseCase,
    private readonly getMonthlySummaryUseCase: GetMonthlySummaryUseCase,
  ) {}

  get = async (_req: Request, res: Response): Promise<void> => {
    try {
      const metrics = await this.getDashboardUseCase.execute();
      res.json(metrics);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  /**
   * GET /api/dashboard/monthly-summary?month=YYYY-MM
   * Returns dashboard metrics for any given month. Defaults to current month
   * (America/Bogota) when the `month` query param is omitted.
   */
  getMonthlySummary = async (req: Request, res: Response): Promise<void> => {
    try {
      const month = typeof req.query.month === 'string' ? req.query.month : undefined;
      const metrics = await this.getMonthlySummaryUseCase.execute(month);
      res.json(metrics);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  private handleError(err: unknown, res: Response): void {
    if (err instanceof CustomError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}
