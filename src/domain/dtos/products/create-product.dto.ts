export class CreateProductDto {
  private constructor(
    public readonly name: string,
    public readonly stock: number,
  ) {}

  static create(object: Record<string, unknown>): [string?, CreateProductDto?] {
    const { name, stock } = object;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return ['El nombre es requerido y debe tener al menos 2 caracteres'];
    }

    if (stock !== undefined && stock !== null) {
      if (typeof stock !== 'number' || !Number.isInteger(stock) || stock < 0) {
        return ['El stock debe ser un número entero mayor o igual a 0'];
      }
    }

    return [
      undefined,
      new CreateProductDto(name.trim(), typeof stock === 'number' ? stock : 0),
    ];
  }
}
