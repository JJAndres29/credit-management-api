import { Request, Response } from 'express';
import { CustomError } from '../../domain/errors';
import { BulkProductsActiveDto } from '../../domain/dtos/admin/bulk-products-active.dto';
import { BulkSetProductsActiveUseCase } from '../../domain/use-cases/products';

export class AdminProductsBulkController {
  constructor(private readonly bulkActive: BulkSetProductsActiveUseCase) {}

  patchBulkActive = async (req: Request, res: Response): Promise<void> => {
    const [err, dto] = BulkProductsActiveDto.create(req.body as Record<string, unknown>);
    if (err) {
      res.status(400).json({ error: err });
      return;
    }
    try {
      const result = await this.bulkActive.execute(dto!);
      res.json(result);
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
