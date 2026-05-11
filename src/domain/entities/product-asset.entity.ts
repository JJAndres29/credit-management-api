export class ProductAssetEntity {
  constructor(
    public readonly id: string,
    public readonly productId: string,
    public readonly variantId: string | null,
    public readonly type: string,
    public readonly position: number,
    public readonly altText: string | null,
    public readonly urlOriginal: string,
    public readonly cloudinaryPublicId: string,
    public readonly createdAt: Date,
  ) {}

  toJSON() {
    return {
      id: this.id,
      productId: this.productId,
      variantId: this.variantId,
      type: this.type,
      position: this.position,
      altText: this.altText,
      urlOriginal: this.urlOriginal,
      cloudinaryPublicId: this.cloudinaryPublicId,
      createdAt: this.createdAt,
    };
  }

  static fromObject(object: Record<string, unknown>): ProductAssetEntity {
    const { id, productId, variantId, type, position, altText, urlOriginal, cloudinaryPublicId, createdAt } = object;

    if (!id) throw new Error('ProductAsset id is required');
    if (!productId) throw new Error('ProductAsset productId is required');
    if (!urlOriginal) throw new Error('ProductAsset urlOriginal is required');
    if (!cloudinaryPublicId) throw new Error('ProductAsset cloudinaryPublicId is required');

    return new ProductAssetEntity(
      id as string,
      productId as string,
      (variantId as string | null | undefined) ?? null,
      (type as string | undefined) ?? 'IMAGE',
      Number(position ?? 0),
      (altText as string | null | undefined) ?? null,
      urlOriginal as string,
      cloudinaryPublicId as string,
      (createdAt as Date) ?? new Date(),
    );
  }
}
