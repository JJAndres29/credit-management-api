import { Request, Response } from 'express';
import { CustomError } from '../../domain/errors';
import { CreateProductDto, UpdateProductDto, AdjustStockDto, FilterProductsDto, UpdateRetailPriceDto, QuickCreateProductDto, QuickCreateWithVariantsDto, ReuseProductAssetsDto } from '../../domain/dtos/products';
import { AssignProductAttributesDto, ReplaceProductAttributesDto } from '../../domain/dtos/categories';
import { PaginationDto } from '../../domain/dtos/shared';
import { GetProductsUseCase } from '../../domain/use-cases/products/get-products.use-case';
import { GetProductByIdUseCase } from '../../domain/use-cases/products/get-product-by-id.use-case';
import { CreateProductUseCase } from '../../domain/use-cases/products/create-product.use-case';
import { UpdateProductUseCase } from '../../domain/use-cases/products/update-product.use-case';
import { AdjustStockUseCase } from '../../domain/use-cases/products/adjust-stock.use-case';
import { UpdateRetailPriceUseCase } from '../../domain/use-cases/products/update-retail-price.use-case';
import { DeleteProductUseCase } from '../../domain/use-cases/products/delete-product.use-case';
import { UploadProductImagesUseCase } from '../../domain/use-cases/products/upload-product-images.use-case';
import { DeleteProductImageUseCase } from '../../domain/use-cases/products/delete-product-image.use-case';
import { AssignProductAttributesUseCase } from '../../domain/use-cases/categories/assign-product-attributes.use-case';
import { RemoveProductAttributeUseCase } from '../../domain/use-cases/categories/remove-product-attribute.use-case';
import { ReplaceProductAttributesUseCase } from '../../domain/use-cases/categories/replace-product-attributes.use-case';
import type { GetProductBySlugConfig } from '../../domain/use-cases/seo';
import { GetProductBySlugUseCase } from '../../domain/use-cases/seo';
import { QuickCreateProductUseCase, QuickCreateWithVariantsUseCase } from '../../domain/use-cases/products';
import { UploadProductAssetsUseCase } from '../../domain/use-cases/products/upload-product-assets.use-case';
import { DeleteProductAssetUseCase } from '../../domain/use-cases/products/delete-product-asset.use-case';
import { ReuseProductAssetsForVariantUseCase } from '../../domain/use-cases/products/reuse-product-assets-for-variant.use-case';

export class ProductController {
  constructor(
    private readonly getProductsUseCase: GetProductsUseCase,
    private readonly getProductByIdUseCase: GetProductByIdUseCase,
    private readonly createProductUseCase: CreateProductUseCase,
    private readonly quickCreateProductUseCase: QuickCreateProductUseCase,
    private readonly updateProductUseCase: UpdateProductUseCase,
    private readonly adjustStockUseCase: AdjustStockUseCase,
    private readonly updateRetailPriceUseCase: UpdateRetailPriceUseCase,
    private readonly deleteProductUseCase: DeleteProductUseCase,
    private readonly uploadProductImagesUseCase: UploadProductImagesUseCase,
    private readonly deleteProductImageUseCase: DeleteProductImageUseCase,
    private readonly assignProductAttributesUseCase: AssignProductAttributesUseCase,
    private readonly replaceProductAttributesUseCase: ReplaceProductAttributesUseCase,
    private readonly removeProductAttributeUseCase: RemoveProductAttributeUseCase,
    private readonly getProductBySlugUseCase: GetProductBySlugUseCase,
    private readonly quickCreateWithVariantsUseCase: QuickCreateWithVariantsUseCase,
    private readonly uploadProductAssetsUseCase: UploadProductAssetsUseCase,
    private readonly deleteProductAssetUseCase: DeleteProductAssetUseCase,
    private readonly reuseProductAssetsForVariantUseCase: ReuseProductAssetsForVariantUseCase,
    private readonly productSeoConfig: GetProductBySlugConfig,
  ) {}

  getBySlug = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.getProductBySlugUseCase.execute(
        req.params.slug,
        this.productSeoConfig,
      );
      if (result.kind === 'redirect') {
        res.redirect(result.statusCode, result.location);
        return;
      }
      res.json({
        product: result.product,
        pageTitle: result.pageTitle,
        pageDescription: result.pageDescription,
        canonicalUrl: result.canonicalUrl,
        jsonLd: result.jsonLd,
      });
    } catch (err) {
      this.handleError(err, res);
    }
  };

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

  quickCreate = async (req: Request, res: Response): Promise<void> => {
    const [error, dto] = QuickCreateProductDto.create(req.body as Record<string, unknown>);
    if (error) {
      res.status(400).json({ error });
      return;
    }
    try {
      const product = await this.quickCreateProductUseCase.execute(dto!);
      res.status(201).json(product);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  quickCreateWithVariants = async (req: Request, res: Response): Promise<void> => {
    const [error, dto] = QuickCreateWithVariantsDto.create(req.body as Record<string, unknown>);
    if (error) {
      res.status(400).json({ error });
      return;
    }
    try {
      const product = await this.quickCreateWithVariantsUseCase.execute(dto!);
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

  updateRetailPrice = async (req: Request, res: Response): Promise<void> => {
    const [error, dto] = UpdateRetailPriceDto.create(req.body as Record<string, unknown>);

    if (error) {
      res.status(400).json({ error });
      return;
    }

    try {
      const product = await this.updateRetailPriceUseCase.execute(req.params.id, dto!.retailPrice);
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

  uploadAssets = async (req: Request, res: Response): Promise<void> => {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      res.status(400).json({ error: 'Debe enviar al menos una imagen' });
      return;
    }

    const variantId = req.body?.variantId as string | undefined;

    try {
      const product = await this.uploadProductAssetsUseCase.execute(
        req.params.id,
        files,
        variantId?.trim() || undefined,
      );
      res.status(201).json(product);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  reuseAssetsForVariant = async (req: Request, res: Response): Promise<void> => {
    const [error, dto] = ReuseProductAssetsDto.create(req.body as Record<string, unknown>);
    if (error) {
      res.status(400).json({ error });
      return;
    }

    try {
      const product = await this.reuseProductAssetsForVariantUseCase.execute(req.params.id, dto!);
      res.status(201).json(product);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  deleteAsset = async (req: Request, res: Response): Promise<void> => {
    try {
      const product = await this.deleteProductAssetUseCase.execute(
        req.params.id,
        req.params.assetId,
      );
      res.json(product);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  assignAttributes = async (req: Request, res: Response): Promise<void> => {
    const [error, dto] = AssignProductAttributesDto.create(req.body as Record<string, unknown>);
    if (error) {
      res.status(400).json({ error });
      return;
    }

    try {
      const product = await this.assignProductAttributesUseCase.execute(req.params.id, dto!.valueIds);
      res.json(product);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  replaceAttributes = async (req: Request, res: Response): Promise<void> => {
    const [error, dto] = ReplaceProductAttributesDto.create(req.body as Record<string, unknown>);
    if (error) {
      res.status(400).json({ error });
      return;
    }

    try {
      const product = await this.replaceProductAttributesUseCase.execute(req.params.id, dto!.valueIds);
      res.json(product);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  deleteAttribute = async (req: Request, res: Response): Promise<void> => {
    try {
      const product = await this.removeProductAttributeUseCase.execute(req.params.id, req.params.valueId);
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
