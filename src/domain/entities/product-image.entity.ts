export class ProductImageEntity {
  constructor(
    public readonly id: string,
    public readonly productId: string,
    public readonly url: string,
    public readonly publicId: string,
    public readonly order: number,
    public readonly createdAt: Date,
  ) {}

  static fromObject(object: Record<string, unknown>): ProductImageEntity {
    const { id, productId, url, publicId, order, createdAt } = object;

    if (!id) throw new Error('ProductImage id is required');
    if (!productId) throw new Error('ProductImage productId is required');
    if (!url) throw new Error('ProductImage url is required');
    if (!publicId) throw new Error('ProductImage publicId is required');

    return new ProductImageEntity(
      id as string,
      productId as string,
      url as string,
      publicId as string,
      Number(order ?? 0),
      (createdAt as Date) ?? new Date(),
    );
  }
}
