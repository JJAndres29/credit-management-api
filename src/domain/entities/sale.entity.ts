export enum SaleType {
  CASH = 'CASH',
  CREDIT = 'CREDIT',
}

export enum SaleStatus {
  PAID = 'PAID',
  PENDING = 'PENDING',
  PARTIAL = 'PARTIAL',
}

export enum InstallmentFrequency {
  MONTHLY = 'MONTHLY',
  BIWEEKLY = 'BIWEEKLY',
}

export class SaleItemEntity {
  constructor(
    public readonly id: string,
    public readonly saleId: string,
    public readonly productId: string,
    public readonly quantity: number,
    /** Precio base del producto al momento de la venta (snapshot de Product.price) */
    public readonly basePrice: number | null,
    public readonly unitPrice: number,
    public readonly subtotal: number,
    /**
     * Regla de pricing aplicada. Ej: "CASH_BASE" | "CREDIT_SURCHARGE_15PCT".
     * Null en ventas creadas antes de la implementación del Pricing Domain Service.
     */
    public readonly appliedRule: string | null,
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
    /** Número de cuotas pactadas. Null si la venta no tiene plan de cuotas. */
    public readonly installmentsCount: number | null = null,
    /** Periodicidad de pago. Null si la venta no tiene plan de cuotas. */
    public readonly frequency: InstallmentFrequency | null = null,
    /** Monto de cada cuota = total / installmentsCount. Null si no aplica. */
    public readonly installmentAmount: number | null = null,
    /**
     * Día del mes en que se realiza el cobro (1-31).
     * Para planes MONTHLY: único día de cobro mensual.
     * Para planes BIWEEKLY: primer día de cobro (junto con collectionDay2).
     * Null si no se definió día de cobro.
     */
    public readonly collectionDay: number | null = null,
    /**
     * Segundo día de cobro (1-31). Exclusivo para planes BIWEEKLY.
     * Null si el plan es MONTHLY o si no se definieron días de cobro.
     */
    public readonly collectionDay2: number | null = null,
  ) {}

  static fromObject(object: Record<string, unknown>): SaleEntity {
    const {
      id, clientId, type, status, total, createdAt, items,
      installmentsCount, frequency, installmentAmount,
      collectionDay, collectionDay2,
    } = object;

    if (!id) throw new Error('Sale id is required');
    if (!clientId) throw new Error('Sale clientId is required');
    if (!type) throw new Error('Sale type is required');
    if (total === undefined) throw new Error('Sale total is required');

    const mappedItems: SaleItemEntity[] = Array.isArray(items)
      ? (items as Record<string, unknown>[]).map(
          (item) =>
            new SaleItemEntity(
              item.id as string,
              item.saleId as string,
              item.productId as string,
              Number(item.quantity),
              item.basePrice != null ? Number(item.basePrice) : null,
              Number(item.unitPrice),
              Number(item.subtotal),
              (item.appliedRule as string | null) ?? null,
            ),
        )
      : [];

    return new SaleEntity(
      id as string,
      clientId as string,
      type as SaleType,
      (status as SaleStatus) ?? SaleStatus.PENDING,
      Number(total),
      (createdAt as Date) ?? new Date(),
      mappedItems,
      installmentsCount != null ? Number(installmentsCount) : null,
      (frequency as InstallmentFrequency | null) ?? null,
      installmentAmount != null ? Number(installmentAmount) : null,
      collectionDay != null ? Number(collectionDay) : null,
      collectionDay2 != null ? Number(collectionDay2) : null,
    );
  }
}
