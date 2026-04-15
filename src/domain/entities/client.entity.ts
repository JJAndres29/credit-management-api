export type DocumentType = 'CC' | 'CE';

export class ClientEntity {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly phone: string,
    public readonly email: string | null,
    public readonly documentType: DocumentType,
    public readonly documentNumber: string,
    public readonly address: string,
    public readonly neighborhood: string,
    public readonly creditLimit: number,
    public readonly balance: number,
    public readonly isActive: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static fromObject(object: Record<string, unknown>): ClientEntity {
    const {
      id,
      name,
      phone,
      email,
      documentType,
      documentNumber,
      address,
      neighborhood,
      creditLimit,
      balance,
      isActive,
      createdAt,
      updatedAt,
    } = object;

    if (!id) throw new Error('Client id is required');
    if (!name) throw new Error('Client name is required');
    if (!phone) throw new Error('Client phone is required');
    if (!documentType) throw new Error('Client documentType is required');
    if (!documentNumber) throw new Error('Client documentNumber is required');
    if (!address) throw new Error('Client address is required');
    if (!neighborhood) throw new Error('Client neighborhood is required');
    if (creditLimit === undefined) throw new Error('Client creditLimit is required');

    return new ClientEntity(
      id as string,
      name as string,
      phone as string,
      (email as string | null) ?? null,
      documentType as DocumentType,
      documentNumber as string,
      address as string,
      neighborhood as string,
      Number(creditLimit),
      Number(balance ?? 0),
      (isActive as boolean) ?? true,
      (createdAt as Date) ?? new Date(),
      (updatedAt as Date) ?? new Date(),
    );
  }
}
