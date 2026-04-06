export enum SaleType {
  CASH = 'CASH',
  CREDIT = 'CREDIT',
}

export enum SaleStatus {
  PAID = 'PAID',
  PENDING = 'PENDING',
  PARTIAL = 'PARTIAL',
}

export class SaleItemEntity {
  constructor(
    public readonly id: string,
    public readonly saleId: string,
    public readonly productId: string,
    public readonly quantity: number,
    public readonly unitPrice: number,
    public readonly subtotal: number,
  ) {}
}

export class SaleEntity {
  constructor(
    public readonly id: string,
    public readonly clientId: string,
    public readonly type: SaleType,
    public readonly status: SaleStatus,
    public readonly total: number,
    public readonly createdAt: Date,
    public readonly items: SaleItemEntity[],
  ) {}

  static fromObject(object: Record<string, unknown>): SaleEntity {
    const { id, clientId, type, status, total, createdAt, items } = object;

    if (!id) throw new Error('Sale id is required');
    if (!clientId) throw new Error('Sale clientId is required');
    if (!type) throw new Error('Sale type is required');
    if (total === undefined) throw new Error('Sale total is required');

    return new SaleEntity(
      id as string,
      clientId as string,
      type as SaleType,
      (status as SaleStatus) ?? SaleStatus.PENDING,
      Number(total),
      (createdAt as Date) ?? new Date(),
      (items as SaleItemEntity[]) ?? [],
    );
  }
}
