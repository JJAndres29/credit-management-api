import { Request, Response } from 'express';
import { CustomError } from '../../domain/errors';
import { UserEntity } from '../../domain/entities';
import {
  GenerateAccountStatementUseCase,
  GetMonthlySummaryUseCase,
} from '../../domain/use-cases/reports';

export class ReportController {
  constructor(
    private readonly generateAccountStatementUseCase: GenerateAccountStatementUseCase,
    private readonly getMonthlySummaryUseCase: GetMonthlySummaryUseCase,
  ) {}

  /**
   * GET /api/reports/account-statement/:clientId
   *
   * Genera y descarga el estado de cuenta en PDF del cliente indicado.
   * El nombre del usuario autenticado queda impreso en el documento
   * como "generado por" — proviene del token JWT, no del body.
   */
  getAccountStatement = async (req: Request, res: Response): Promise<void> => {
    try {
      const { clientId } = req.params;
      const user = (req as Request & { user: UserEntity }).user;
      const generatedBy = user?.name ?? 'Sistema';

      const pdfBuffer = await this.generateAccountStatementUseCase.execute(clientId, generatedBy);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="estado-cuenta-${clientId.slice(0, 8)}.pdf"`,
      );
      res.setHeader('Content-Length', pdfBuffer.length);

      res.end(pdfBuffer);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  getMonthlySummary = async (req: Request, res: Response): Promise<void> => {
    const year = parseInt(req.query.year as string);
    const month = parseInt(req.query.month as string);

    try {
      const result = await this.getMonthlySummaryUseCase.execute(year, month);
      res.json(result);
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
