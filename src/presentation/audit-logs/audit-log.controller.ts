import { Request, Response } from 'express';
import { CustomError } from '../../domain/errors';
import { FilterAuditLogsDto } from '../../domain/dtos/audit-logs';
import { PaginationDto } from '../../domain/dtos/shared';
import { GetAuditLogsUseCase } from '../../domain/use-cases/audit-logs/get-audit-logs.use-case';
import { GetAuditLogsByClientUseCase } from '../../domain/use-cases/audit-logs/get-audit-logs-by-client.use-case';

export class AuditLogController {
  constructor(
    private readonly getAuditLogsUseCase: GetAuditLogsUseCase,
    private readonly getAuditLogsByClientUseCase: GetAuditLogsByClientUseCase,
  ) {}

  getAll = async (req: Request, res: Response): Promise<void> => {
    const [pError, pagination] = PaginationDto.create(req.query as Record<string, unknown>);
    if (pError) { res.status(400).json({ error: pError }); return; }

    const [fError, filters] = FilterAuditLogsDto.create(req.query as Record<string, unknown>);
    if (fError) { res.status(400).json({ error: fError }); return; }

    try {
      const result = await this.getAuditLogsUseCase.execute(pagination!, filters!);
      res.json(result);
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
