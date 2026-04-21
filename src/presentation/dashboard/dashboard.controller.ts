import { Request, Response } from 'express';
import { CustomError } from '../../domain/errors';
import { GetDashboardUseCase } from '../../domain/use-cases/dashboard';

export class DashboardController {
  constructor(private readonly getDashboardUseCase: GetDashboardUseCase) {}

  get = async (_req: Request, res: Response): Promise<void> => {
    try {
      const metrics = await this.getDashboardUseCase.execute();
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
