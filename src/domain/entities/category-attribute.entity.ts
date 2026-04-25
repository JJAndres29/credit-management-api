export class CategoryAttributeEntity {
  constructor(
    public readonly id: string,
    public readonly categoryId: string,
    public readonly name: string,
    public readonly createdAt: Date,
  ) {}

  static fromObject(object: Record<string, unknown>): CategoryAttributeEntity {
    const { id, categoryId, name, createdAt } = object;

    if (!id) throw new Error('CategoryAttribute id is required');
    if (!categoryId) throw new Error('CategoryAttribute categoryId is required');
    if (!name) throw new Error('CategoryAttribute name is required');

    return new CategoryAttributeEntity(
      id as string,
      categoryId as string,
      name as string,
      (createdAt as Date) ?? new Date(),
    );
  }
}
