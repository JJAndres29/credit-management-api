import { ProductDatasource } from '../../domain/datasources';
import { ProductRepository } from '../../domain/repositories';
import { ProductEntity } from '../../domain/entities';
import { CreateProductDto, UpdateProductDto, FilterProductsDto } from '../../domain/dtos/products';
import type { QuickCreateProductData } from '../../domain/datasources/product.datasource';
import { UploadResult } from '../../domain/services/file-storage.service';
import { PaginationDto } from '../../domain/dtos/shared';
import { PaginatedResult } from '../../domain/types/paginated.type';

export class ProductRepositoryImpl implements ProductRepository {
  constructor(private readonly datasource: ProductDatasource) {}

  findAll(pagination: PaginationDto, filters: FilterProductsDto): Promise<PaginatedResult<ProductEntity>> {
    return this.datasource.findAll(pagination, filters);
  }

  findById(id: string): Promise<ProductEntity | null> {
    return this.datasource.findById(id);
  }

  create(dto: CreateProductDto): Promise<ProductEntity> {
    return this.datasource.create(dto);
  }

  update(id: string, dto: UpdateProductDto): Promise<ProductEntity> {
    return this.datasource.update(id, dto);
  }

  adjustStock(id: string, quantity: number): Promise<ProductEntity> {
    return this.datasource.adjustStock(id, quantity);
  }

  delete(id: string): Promise<ProductEntity> {
    return this.datasource.delete(id);
  }

  addImages(productId: string, images: UploadResult[]): Promise<ProductEntity> {
    return this.datasource.addImages(productId, images);
  }

  removeImage(productId: string, imageId: string): Promise<ProductEntity> {
    return this.datasource.removeImage(productId, imageId);
  }

  updateRetailPrice(id: string, retailPrice: number | null): Promise<ProductEntity> {
    return this.datasource.updateRetailPrice(id, retailPrice);
  }

  assignAttributes(productId: string, valueIds: string[]): Promise<ProductEntity> {
    return this.datasource.assignAttributes(productId, valueIds);
  }

  replaceAttributes(productId: string, valueIds: string[]): Promise<ProductEntity> {
    return this.datasource.replaceAttributes(productId, valueIds);
  }

  removeAttribute(productId: string, valueId: string): Promise<ProductEntity> {
    return this.datasource.removeAttribute(productId, valueId);
  }

  quickCreate(data: QuickCreateProductData): Promise<ProductEntity> {
    return this.datasource.quickCreate(data);
  }

  bulkSetActive(productIds: string[], isActive: boolean): Promise<number> {
    return this.datasource.bulkSetActive(productIds, isActive);
  }
}
