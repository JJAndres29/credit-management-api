import { Request, Response } from 'express';
import { CustomError } from '../../domain/errors';
import { GetAuditLogsUseCase } from '../../domain/use-cases/audit-logs/get-audit-logs.use-case';
import { GetAuditLogsByClientUseCase } from '../../domain/use-cases/audit-logs/get-audit-logs-by-client.use-case';

export class AuditLogController {
  constructor(
    private readonly getAuditLogsUseCase: GetAuditLogsUseCase,
    private readonly getAuditLogsByClientUseCase: GetAuditLogsByClientUseCase,
  ) {}

  getAll = async (_req: Request, res: Response): Promise<void> => {
    try {
      const logs = await this.getAuditLogsUseCase.execute();
      res.json(logs);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  getByClient = async (req: Request, res: Response): Promise<void> => {
    try {
      const logs = await this.getAuditLogsByClientUseCase.execute(req.params.clientId);
      res.json(logs);
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
