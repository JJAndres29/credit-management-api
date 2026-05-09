import { Request, Response } from 'express';
import { GetCollectionsUseCase } from '../../domain/use-cases/collections';
import { FilterInstallmentsDto } from '../../domain/dtos/collections';
import { PaginationDto } from '../../domain/dtos/shared';
import { CustomError } from '../../domain/errors';
import { globalLogger } from '../../infrastructure/services';

export class CollectionController {
  constructor(private readonly getCollectionsUseCase: GetCollectionsUseCase) {}

  getInstallments = async (req: Request, res: Response): Promise<void> => {
    const [paginationError, pagination] = PaginationDto.create(
      req.query as Record<string, unknown>,
    );
    if (paginationError) {
      res.status(400).json({ error: paginationError });
      return;
    }

    const [filterError, filters] = FilterInstallmentsDto.create(
      req.query as Record<string, unknown>,
    );
    if (filterError) {
      res.status(400).json({ error: filterError });
      return;
    }

    try {
      const result = await this.getCollectionsUseCase.execute(pagination!, filters!);
      res.json(result);
    } catch (error) {
      this.handleError(error, res);
    }
  };

  private handleError(error: unknown, res: Response): void {
    if (error instanceof CustomError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    globalLogger.error('[CollectionController]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
