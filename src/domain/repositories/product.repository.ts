import { ProductAssetEntity, ProductEntity } from '../entities';
import { CreateProductDto, UpdateProductDto, FilterProductsDto } from '../dtos/products';
import type { AssetCreateData, QuickCreateProductData, QuickCreateWithVariantsData, AssetReuseForVariantData } from '../datasources/product.datasource';
import { UploadResult } from '../services/file-storage.service';
import { PaginationDto } from '../dtos/shared';
import { PaginatedResult } from '../types/paginated.type';

export interface ProductRepository {
  findAll(pagination: PaginationDto, filters: FilterProductsDto): Promise<PaginatedResult<ProductEntity>>;
  findById(id: string): Promise<ProductEntity | null>;
  create(dto: CreateProductDto): Promise<ProductEntity>;
  update(id: string, dto: UpdateProductDto): Promise<ProductEntity>;
  adjustStock(id: string, quantity: number): Promise<ProductEntity>;
  delete(id: string): Promise<ProductEntity>;
  addImages(productId: string, images: UploadResult[]): Promise<ProductEntity>;
  removeImage(productId: string, imageId: string): Promise<ProductEntity>;
  updateRetailPrice(id: string, retailPrice: number | null): Promise<ProductEntity>;
  assignAttributes(productId: string, valueIds: string[]): Promise<ProductEntity>;
  replaceAttributes(productId: string, valueIds: string[]): Promise<ProductEntity>;
  removeAttribute(productId: string, valueId: string): Promise<ProductEntity>;

  quickCreate(data: QuickCreateProductData): Promise<ProductEntity>;

  quickCreateWithVariants(data: QuickCreateWithVariantsData): Promise<ProductEntity>;

  addAssets(data: AssetCreateData): Promise<ProductEntity>;
  reuseGeneralAssetsForVariant(data: AssetReuseForVariantData): Promise<ProductEntity>;
  findAssetById(assetId: string): Promise<ProductAssetEntity | null>;
  removeAsset(productId: string, assetId: string): Promise<ProductEntity>;
  countAssetsByCloudinaryPublicId(cloudinaryPublicId: string): Promise<number>;

  bulkSetActive(productIds: string[], isActive: boolean): Promise<number>;
}
