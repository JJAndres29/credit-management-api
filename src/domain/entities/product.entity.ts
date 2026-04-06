export class ProductEntity {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly price: number,
    public readonly stock: number,
    public readonly imageUrl: string | null,
    public readonly isActive: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static fromObject(object: Record<string, unknown>): ProductEntity {
    const { id, name, price, stock, imageUrl, isActive, createdAt, updatedAt } = object;

    if (!id) throw new Error('Product id is required');
    if (!name) throw new Error('Product name is required');
    if (price === undefined) throw new Error('Product price is required');

    return new ProductEntity(
      id as string,
      name as string,
      Number(price),
      Number(stock ?? 0),
      (imageUrl as string | null) ?? null,
      (isActive as boolean) ?? true,
      (createdAt as Date) ?? new Date(),
      (updatedAt as Date) ?? new Date(),
    );
  }
}
