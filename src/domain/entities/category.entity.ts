export class CategoryEntity {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly slug: string | null = null,
    public readonly description: string | null = null,
    public readonly metaTitle: string | null = null,
    public readonly metaDescription: string | null = null,
  ) {}

  static fromObject(object: Record<string, unknown>): CategoryEntity {
    const { id, name, createdAt, updatedAt, slug, description, metaTitle, metaDescription } = object;

    if (!id) throw new Error('Category id is required');
    if (!name) throw new Error('Category name is required');

    return new CategoryEntity(
      id as string,
      name as string,
      (createdAt as Date) ?? new Date(),
      (updatedAt as Date) ?? new Date(),
      (slug as string | null | undefined) ?? null,
      (description as string | null | undefined) ?? null,
      (metaTitle as string | null | undefined) ?? null,
      (metaDescription as string | null | undefined) ?? null,
    );
  }
}
