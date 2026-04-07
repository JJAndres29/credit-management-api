import { ProductEntity } from '../entities';
import { CreateProductDto, UpdateProductDto } from '../dtos/products';
import { UploadResult } from '../services/file-storage.service';

export interface ProductRepository {
  findAll(): Promise<ProductEntity[]>;
  findById(id: string): Promise<ProductEntity | null>;
  create(dto: CreateProductDto): Promise<ProductEntity>;
  update(id: string, dto: UpdateProductDto): Promise<ProductEntity>;
  adjustStock(id: string, quantity: number): Promise<ProductEntity>;
  delete(id: string): Promise<ProductEntity>;
  addImages(productId: string, images: UploadResult[]): Promise<ProductEntity>;
  removeImage(productId: string, imageId: string): Promise<ProductEntity>;
}
