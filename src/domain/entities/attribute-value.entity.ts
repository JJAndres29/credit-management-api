export class AttributeValueEntity {
  constructor(
    public readonly id: string,
    public readonly attributeId: string,
    public readonly value: string,
    public readonly createdAt: Date,
  ) {}

  static fromObject(object: Record<string, unknown>): AttributeValueEntity {
    const { id, attributeId, value, createdAt } = object;

    if (!id) throw new Error('AttributeValue id is required');
    if (!attributeId) throw new Error('AttributeValue attributeId is required');
    if (!value) throw new Error('AttributeValue value is required');

    return new AttributeValueEntity(
      id as string,
      attributeId as string,
      value as string,
      (createdAt as Date) ?? new Date(),
    );
  }
}
