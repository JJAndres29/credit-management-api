export class UpdateProductDto {
  private constructor(
    public readonly name: string,
  ) {}

  static create(object: Record<string, unknown>): [string?, UpdateProductDto?] {
    const { name } = object;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return ['El nombre es requerido y debe tener al menos 2 caracteres'];
    }

    return [undefined, new UpdateProductDto(name.trim())];
  }
}
