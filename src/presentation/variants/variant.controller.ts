import { Request, Response } from 'express';
import { CustomError } from '../../domain/errors';
import { CreateVariantDto, UpdateVariantDto } from '../../domain/dtos/variants';
import { GetVariantsUseCase } from '../../domain/use-cases/variants/get-variants.use-case';
import { CreateVariantUseCase } from '../../domain/use-cases/variants/create-variant.use-case';
import { UpdateVariantUseCase } from '../../domain/use-cases/variants/update-variant.use-case';
import { DeleteVariantUseCase } from '../../domain/use-cases/variants/delete-variant.use-case';

export class VariantController {
  constructor(
    private readonly getVariantsUseCase: GetVariantsUseCase,
    private readonly createVariantUseCase: CreateVariantUseCase,
    private readonly updateVariantUseCase: UpdateVariantUseCase,
    private readonly deleteVariantUseCase: DeleteVariantUseCase,
  ) {}

  getByProduct = async (req: Request, res: Response): Promise<void> => {
    try {
      const variants = await this.getVariantsUseCase.execute(req.params.productId);
      res.json(variants.map((v) => v.toJSON()));
    } catch (err) {
      this.handleError(err, res);
    }
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const body = { ...req.body, productId: req.params.productId } as Record<string, unknown>;
    const [error, dto] = CreateVariantDto.create(body);

    if (error) {
      res.status(400).json({ error });
      return;
    }

    try {
      const variant = await this.createVariantUseCase.execute(dto!);
      res.status(201).json(variant.toJSON());
    } catch (err) {
      this.handleError(err, res);
    }
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const [error, dto] = UpdateVariantDto.create(req.body as Record<string, unknown>);

    if (error) {
      res.status(400).json({ error });
      return;
    }

    try {
      const variant = await this.updateVariantUseCase.execute(req.params.variantId, dto!);
      res.json(variant.toJSON());
    } catch (err) {
      this.handleError(err, res);
    }
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    try {
      const variant = await this.deleteVariantUseCase.execute(req.params.variantId);
      res.json(variant.toJSON());
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
