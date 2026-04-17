export class PaymentEntity {
  constructor(
    public readonly id: string,
    public readonly clientId: string,
    public readonly saleId: string | null,
    public readonly amount: number,
    public readonly note: string | null,
    public readonly createdAt: Date,
    public readonly clientDocumentNumber: string | null = null,
  ) {}

  static fromObject(object: Record<string, unknown>): PaymentEntity {
    const { id, clientId, saleId, amount, note, createdAt, client } = object;

    if (!id) throw new Error('Payment id is required');
    if (!clientId) throw new Error('Payment clientId is required');
    if (amount === undefined) throw new Error('Payment amount is required');

    const clientDocumentNumber =
      client && typeof client === 'object' && 'documentNumber' in client
        ? (client as Record<string, unknown>).documentNumber as string
        : null;

    return new PaymentEntity(
      id as string,
      clientId as string,
      (saleId as string | null) ?? null,
      Number(amount),
      (note as string | null) ?? null,
      (createdAt as Date) ?? new Date(),
      clientDocumentNumber,
    );
  }
}
