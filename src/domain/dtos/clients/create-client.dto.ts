export class CreateClientDto {
  private constructor(
    public readonly name: string,
    public readonly phone: string,
    public readonly creditLimit: number,
    public readonly email?: string,
  ) {}

  static create(object: Record<string, unknown>): [string?, CreateClientDto?] {
    const { name, phone, email, creditLimit } = object;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return ['El nombre es requerido y debe tener al menos 2 caracteres'];
    }
    if (!phone || typeof phone !== 'string') {
      return ['El teléfono es requerido'];
    }
    if (email !== undefined && (typeof email !== 'string' || !email.includes('@'))) {
      return ['El email no tiene un formato válido'];
    }
    if (creditLimit === undefined || creditLimit === null) {
      return ['El límite de crédito es requerido'];
    }
    if (typeof creditLimit !== 'number' || creditLimit < 0) {
      return ['El límite de crédito debe ser un número mayor o igual a 0'];
    }

    return [
      undefined,
      new CreateClientDto(name.trim(), phone.trim(), creditLimit, email as string | undefined),
    ];
  }
}
