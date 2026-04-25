import { Request, Response } from 'express';
import { CreateAttributeValueDto, CreateCategoryAttributeDto } from '../../domain/dtos/categories';
import { CustomError } from '../../domain/errors';
import {
  CreateAttributeValueUseCase,
  DeleteCategoryAttributeUseCase,
  DeleteAttributeValueUseCase,
  GetAttributeValuesUseCase,
  UpdateAttributeValueUseCase,
  UpdateCategoryAttributeUseCase,
} from '../../domain/use-cases/categories';

export class AttributeController {
  constructor(
    private readonly deleteCategoryAttributeUseCase: DeleteCategoryAttributeUseCase,
    private readonly updateCategoryAttributeUseCase: UpdateCategoryAttributeUseCase,
    private readonly createAttributeValueUseCase: CreateAttributeValueUseCase,
    private readonly getAttributeValuesUseCase: GetAttributeValuesUseCase,
    private readonly deleteAttributeValueUseCase: DeleteAttributeValueUseCase,
    private readonly updateAttributeValueUseCase: UpdateAttributeValueUseCase,
  ) {}

  deleteAttribute = async (req: Request, res: Response): Promise<void> => {
    try {
      const attribute = await this.deleteCategoryAttributeUseCase.execute(req.params.id);
      res.json(attribute);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  updateAttribute = async (req: Request, res: Response): Promise<void> => {
    const [error, dto] = CreateCategoryAttributeDto.create(req.body as Record<string, unknown>);
    if (error) { res.status(400).json({ error }); return; }

    try {
      const attribute = await this.updateCategoryAttributeUseCase.execute(req.params.id, dto!.name);
      res.json(attribute);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  createValue = async (req: Request, res: Response): Promise<void> => {
    const [error, dto] = CreateAttributeValueDto.create(req.body as Record<string, unknown>);
    if (error) { res.status(400).json({ error }); return; }

    try {
      const value = await this.createAttributeValueUseCase.execute(req.params.id, dto!.value);
      res.status(201).json(value);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  getValues = async (req: Request, res: Response): Promise<void> => {
    try {
      const values = await this.getAttributeValuesUseCase.execute(req.params.id);
      res.json(values);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  deleteValue = async (req: Request, res: Response): Promise<void> => {
    try {
      const value = await this.deleteAttributeValueUseCase.execute(req.params.id);
      res.json(value);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  updateValue = async (req: Request, res: Response): Promise<void> => {
    const [error, dto] = CreateAttributeValueDto.create(req.body as Record<string, unknown>);
    if (error) { res.status(400).json({ error }); return; }

    try {
      const value = await this.updateAttributeValueUseCase.execute(req.params.id, dto!.value);
      res.json(value);
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
