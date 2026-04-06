export class UpdateClientDto {
  private constructor(
    public readonly name?: string,
    public readonly phone?: string,
    public readonly email?: string,
    public readonly creditLimit?: number,
  ) {}

  static create(object: Record<string, unknown>): [string?, UpdateClientDto?] {
    const { name, phone, email, creditLimit } = object;

    if (name !== undefined && (typeof name !== 'string' || name.trim().length < 2)) {
      return ['El nombre debe tener al menos 2 caracteres'];
    }
    if (phone !== undefined && typeof phone !== 'string') {
      return ['El teléfono no es válido'];
    }
    if (email !== undefined && (typeof email !== 'string' || !email.includes('@'))) {
      return ['El email no tiene un formato válido'];
    }
    if (creditLimit !== undefined && (typeof creditLimit !== 'number' || creditLimit < 0)) {
      return ['El límite de crédito debe ser un número mayor o igual a 0'];
    }

    const hasAtLeastOneField = name ?? phone ?? email ?? creditLimit;
    if (!hasAtLeastOneField && creditLimit === undefined) {
      return ['Debe enviar al menos un campo para actualizar'];
    }

    return [
      undefined,
      new UpdateClientDto(
        name as string | undefined,
        phone as string | undefined,
        email as string | undefined,
        creditLimit as number | undefined,
      ),
    ];
  }
}
