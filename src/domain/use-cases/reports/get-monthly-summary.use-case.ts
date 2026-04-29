import { CustomError } from '../../errors';
import { MonthlySummaryPort, MonthlySummaryResult } from '../../services';

export class GetMonthlySummaryUseCase {
  constructor(private readonly summaryPort: MonthlySummaryPort) {}

  async execute(year: number, month: number): Promise<MonthlySummaryResult> {
    if (!Number.isInteger(year) || year <= 2000) {
      throw CustomError.badRequest('Año inválido');
    }

    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw CustomError.badRequest('Mes inválido');
    }

    return this.summaryPort.getSummary(year, month);
  }
}
