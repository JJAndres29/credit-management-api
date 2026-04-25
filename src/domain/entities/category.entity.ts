export class CategoryEntity {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static fromObject(object: Record<string, unknown>): CategoryEntity {
    const { id, name, createdAt, updatedAt } = object;

    if (!id) throw new Error('Category id is required');
    if (!name) throw new Error('Category name is required');

    return new CategoryEntity(
      id as string,
      name as string,
      (createdAt as Date) ?? new Date(),
      (updatedAt as Date) ?? new Date(),
    );
  }
}
