export class UpdateProductDto {
  private constructor(
    public readonly name?: string,
    public readonly price?: number,
  ) {}

  static create(object: Record<string, unknown>): [string?, UpdateProductDto?] {
    const { name, price } = object;

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2) {
        return ['El nombre debe tener al menos 2 caracteres'];
      }
    }

    if (price !== undefined) {
      if (typeof price !== 'number' || price <= 0) {
        return ['El precio debe ser un número mayor a 0'];
      }
    }

    if (name === undefined && price === undefined) {
      return ['Debe proporcionar al menos un campo para actualizar'];
    }

    return [
      undefined,
      new UpdateProductDto(name ? (name as string).trim() : undefined, price as number | undefined),
    ];
  }
}
