export class PaymentEntity {
  constructor(
    public readonly id: string,
    public readonly clientId: string,
    public readonly saleId: string | null,
    public readonly amount: number,
    public readonly note: string | null,
    public readonly createdAt: Date,
  ) {}

  static fromObject(object: Record<string, unknown>): PaymentEntity {
    const { id, clientId, saleId, amount, note, createdAt } = object;

    if (!id) throw new Error('Payment id is required');
    if (!clientId) throw new Error('Payment clientId is required');
    if (amount === undefined) throw new Error('Payment amount is required');

    return new PaymentEntity(
      id as string,
      clientId as string,
      (saleId as string | null) ?? null,
      Number(amount),
      (note as string | null) ?? null,
      (createdAt as Date) ?? new Date(),
    );
  }
}
