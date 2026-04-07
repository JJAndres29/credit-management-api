import { ProductDatasource } from '../../domain/datasources';
import { ProductRepository } from '../../domain/repositories';
import { ProductEntity } from '../../domain/entities';
import { CreateProductDto, UpdateProductDto } from '../../domain/dtos/products';
import { UploadResult } from '../../domain/services/file-storage.service';

export class ProductRepositoryImpl implements ProductRepository {
  constructor(private readonly datasource: ProductDatasource) {}

  findAll(): Promise<ProductEntity[]> {
    return this.datasource.findAll();
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
}
