import { Request, Response } from 'express';
import { CustomError } from '../../domain/errors';
import { CreateProductDto, UpdateProductDto, AdjustStockDto, FilterProductsDto } from '../../domain/dtos/products';
import { PaginationDto } from '../../domain/dtos/shared';
import { GetProductsUseCase } from '../../domain/use-cases/products/get-products.use-case';
import { GetProductByIdUseCase } from '../../domain/use-cases/products/get-product-by-id.use-case';
import { CreateProductUseCase } from '../../domain/use-cases/products/create-product.use-case';
import { UpdateProductUseCase } from '../../domain/use-cases/products/update-product.use-case';
import { AdjustStockUseCase } from '../../domain/use-cases/products/adjust-stock.use-case';
import { DeleteProductUseCase } from '../../domain/use-cases/products/delete-product.use-case';
import { UploadProductImagesUseCase } from '../../domain/use-cases/products/upload-product-images.use-case';
import { DeleteProductImageUseCase } from '../../domain/use-cases/products/delete-product-image.use-case';

export class ProductController {
  constructor(
    private readonly getProductsUseCase: GetProductsUseCase,
    private readonly getProductByIdUseCase: GetProductByIdUseCase,
    private readonly createProductUseCase: CreateProductUseCase,
    private readonly updateProductUseCase: UpdateProductUseCase,
    private readonly adjustStockUseCase: AdjustStockUseCase,
    private readonly deleteProductUseCase: DeleteProductUseCase,
    private readonly uploadProductImagesUseCase: UploadProductImagesUseCase,
    private readonly deleteProductImageUseCase: DeleteProductImageUseCase,
  ) {}

  getAll = async (req: Request, res: Response): Promise<void> => {
    const [pError, pagination] = PaginationDto.create(req.query as Record<string, unknown>);
    if (pError) { res.status(400).json({ error: pError }); return; }

    const [fError, filters] = FilterProductsDto.create(req.query as Record<string, unknown>);
    if (fError) { res.status(400).json({ error: fError }); return; }

    try {
      const result = await this.getProductsUseCase.execute(pagination!, filters!);
      res.json(result);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    try {
      const product = await this.getProductByIdUseCase.execute(req.params.id);
      res.json(product);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const [error, dto] = CreateProductDto.create(req.body as Record<string, unknown>);

    if (error) {
      res.status(400).json({ error });
      return;
    }

    try {
      const product = await this.createProductUseCase.execute(dto!);
      res.status(201).json(product);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const [error, dto] = UpdateProductDto.create(req.body as Record<string, unknown>);

    if (error) {
      res.status(400).json({ error });
      return;
    }

    try {
      const product = await this.updateProductUseCase.execute(req.params.id, dto!);
      res.json(product);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  adjustStock = async (req: Request, res: Response): Promise<void> => {
    const [error, dto] = AdjustStockDto.create(req.body as Record<string, unknown>);

    if (error) {
      res.status(400).json({ error });
      return;
    }

    try {
      const product = await this.adjustStockUseCase.execute(req.params.id, dto!.quantity);
      res.json(product);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    try {
      const product = await this.deleteProductUseCase.execute(req.params.id);
      res.json(product);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  uploadImages = async (req: Request, res: Response): Promise<void> => {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      res.status(400).json({ error: 'Debe enviar al menos una imagen' });
      return;
    }

    try {
      const product = await this.uploadProductImagesUseCase.execute(req.params.id, files);
      res.json(product);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  deleteImage = async (req: Request, res: Response): Promise<void> => {
    try {
      const product = await this.deleteProductImageUseCase.execute(
        req.params.id,
        req.params.imageId,
      );
      res.json(product);
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
