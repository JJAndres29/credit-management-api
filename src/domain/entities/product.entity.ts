import { ProductImageEntity } from './product-image.entity';

export class ProductEntity {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly stock: number,
    public readonly images: ProductImageEntity[],
    public readonly isActive: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      stock: this.stock,
      images: this.images,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static fromObject(object: Record<string, unknown>): ProductEntity {
    const { id, name, stock, images, isActive, createdAt, updatedAt } = object;

    if (!id) throw new Error('Product id is required');
    if (!name) throw new Error('Product name is required');

    const parsedImages = Array.isArray(images)
      ? images.map((img) => ProductImageEntity.fromObject(img as Record<string, unknown>))
      : [];

    return new ProductEntity(
      id as string,
      name as string,
      Number(stock ?? 0),
      parsedImages,
      (isActive as boolean) ?? true,
      (createdAt as Date) ?? new Date(),
      (updatedAt as Date) ?? new Date(),
    );
  }
}
