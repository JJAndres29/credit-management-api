const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_IDS = 200;

export class BulkProductsActiveDto {
  private constructor(
    public readonly productIds: string[],
    public readonly isActive: boolean,
  ) {}

  static create(object: Record<string, unknown>): [string?, BulkProductsActiveDto?] {
    const { productIds, isActive } = object;
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return ['productIds debe ser un arreglo no vacío de UUIDs'];
    }
    if (productIds.length > MAX_IDS) {
      return [`productIds máximo ${MAX_IDS} elementos`];
    }
    const ids: string[] = [];
    for (const id of productIds) {
      if (typeof id !== 'string' || !UUID_V4.test(id.trim())) {
        return ['cada productId debe ser UUID v4'];
      }
      ids.push(id.trim());
    }
    if (typeof isActive !== 'boolean') {
      return ['isActive debe ser boolean'];
    }
    return [undefined, new BulkProductsActiveDto(ids, isActive)];
  }
}
