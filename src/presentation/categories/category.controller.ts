import { Request, Response } from 'express';
import { CustomError } from '../../domain/errors';
import {
  CreateCategoryAttributeDto,
  CreateCategoryDto,
  UpdateCategoryDto,
} from '../../domain/dtos/categories';
import {
  CreateCategoryAttributeUseCase,
  CreateCategoryUseCase,
  DeleteCategoryAttributeUseCase,
  DeleteCategoryUseCase,
  GetCategoriesUseCase,
  GetCategoryAttributesUseCase,
  UpdateCategoryUseCase,
} from '../../domain/use-cases/categories';
import type { GetCategoryBySlugConfig } from '../../domain/use-cases/seo';
import { GetCategoryBySlugUseCase } from '../../domain/use-cases/seo';

export class CategoryController {
  constructor(
    private readonly createCategoryUseCase: CreateCategoryUseCase,
    private readonly getCategoriesUseCase: GetCategoriesUseCase,
    private readonly updateCategoryUseCase: UpdateCategoryUseCase,
    private readonly deleteCategoryUseCase: DeleteCategoryUseCase,
    private readonly createCategoryAttributeUseCase: CreateCategoryAttributeUseCase,
    private readonly getCategoryAttributesUseCase: GetCategoryAttributesUseCase,
    private readonly deleteCategoryAttributeUseCase: DeleteCategoryAttributeUseCase,
    private readonly getCategoryBySlugUseCase: GetCategoryBySlugUseCase,
    private readonly categorySeoConfig: GetCategoryBySlugConfig,
  ) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const [error, dto] = CreateCategoryDto.create(req.body as Record<string, unknown>);
    if (error) { res.status(400).json({ error }); return; }

    try {
      const category = await this.createCategoryUseCase.execute(dto!);
      res.status(201).json(category);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  getBySlug = async (req: Request, res: Response): Promise<void> => {
    try {
      const out = await this.getCategoryBySlugUseCase.execute(
        req.params.slug,
        this.categorySeoConfig,
      );
      res.json({
        category: out.category,
        pageTitle: out.pageTitle,
        pageDescription: out.pageDescription,
        canonicalUrl: out.canonicalUrl,
        jsonLd: out.jsonLd,
      });
    } catch (err) {
      this.handleError(err, res);
    }
  };

  getAll = async (_req: Request, res: Response): Promise<void> => {
    try {
      const categories = await this.getCategoriesUseCase.execute();
      res.json(categories);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const [error, dto] = UpdateCategoryDto.create(req.body as Record<string, unknown>);
    if (error) { res.status(400).json({ error }); return; }

    try {
      const category = await this.updateCategoryUseCase.execute(req.params.id, dto!);
      res.json(category);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    try {
      const category = await this.deleteCategoryUseCase.execute(req.params.id);
      res.json(category);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  createAttribute = async (req: Request, res: Response): Promise<void> => {
    const [error, dto] = CreateCategoryAttributeDto.create(req.body as Record<string, unknown>);
    if (error) { res.status(400).json({ error }); return; }

    try {
      const attribute = await this.createCategoryAttributeUseCase.execute(req.params.id, dto!.name);
      res.status(201).json(attribute);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  getCategoryAttributes = async (req: Request, res: Response): Promise<void> => {
    try {
      const attributes = await this.getCategoryAttributesUseCase.execute(req.params.id);
      res.json(attributes);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  deleteAttribute = async (req: Request, res: Response): Promise<void> => {
    try {
      const attribute = await this.deleteCategoryAttributeUseCase.execute(req.params.id);
      res.json(attribute);
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
