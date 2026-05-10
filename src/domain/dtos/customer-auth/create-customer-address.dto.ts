export class CreateCustomerAddressDto {
  private constructor(
    public readonly line1: string,
    public readonly city: string,
    public readonly department: string,
    public readonly label: string | null,
    public readonly line2: string | null,
    public readonly postalCode: string | null,
    public readonly phone: string | null,
    public readonly isDefault: boolean,
  ) {}

  static create(object: Record<string, unknown>): [string?, CreateCustomerAddressDto?] {
    const { line1, city, department, label, line2, postalCode, phone, isDefault } = object;

    if (!line1 || typeof line1 !== 'string' || line1.trim().length < 3) {
      return ['line1 debe tener al menos 3 caracteres'];
    }
    if (!city || typeof city !== 'string' || city.trim().length < 2) {
      return ['city es requerido'];
    }
    if (!department || typeof department !== 'string' || department.trim().length < 2) {
      return ['department es requerido'];
    }

    let parsedDefault = false;
    if (isDefault !== undefined && isDefault !== null) {
      if (typeof isDefault === 'boolean') parsedDefault = isDefault;
      else if (isDefault === 'true') parsedDefault = true;
      else if (isDefault === 'false') parsedDefault = false;
      else return ['isDefault debe ser booleano'];
    }

    return [
      undefined,
      new CreateCustomerAddressDto(
        line1.trim(),
        city.trim(),
        department.trim(),
        label && typeof label === 'string' ? label.trim() : null,
        line2 && typeof line2 === 'string' ? line2.trim() : null,
        postalCode && typeof postalCode === 'string' ? postalCode.trim() : null,
        phone && typeof phone === 'string' ? phone.trim() : null,
        parsedDefault,
      ),
    ];
  }
}
