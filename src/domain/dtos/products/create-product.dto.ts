export class CreateProductDto {
  private constructor(
    public readonly name: string,
    public readonly stock: number,
    public readonly categoryId: string | null,
    public readonly investmentCost: number | null,
  ) {}

  static create(object: Record<string, unknown>): [string?, CreateProductDto?] {
    const { name, stock, categoryId, investmentCost } = object;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return ['El nombre es requerido y debe tener al menos 2 caracteres'];
    }

    if (stock !== undefined && stock !== null) {
      if (typeof stock !== 'number' || !Number.isInteger(stock) || stock < 0) {
        return ['El stock debe ser un número entero mayor o igual a 0'];
      }
    }

    if (categoryId !== undefined && categoryId !== null && typeof categoryId !== 'string') {
      return ['El categoryId debe ser un string'];
    }

    if (investmentCost !== undefined && investmentCost !== null) {
      if (typeof investmentCost !== 'number' || Number.isNaN(investmentCost) || investmentCost < 0) {
        return ['El costo de inversión debe ser un número mayor o igual a 0'];
      }
    }

    return [
      undefined,
      new CreateProductDto(
        name.trim(),
        typeof stock === 'number' ? stock : 0,
        typeof categoryId === 'string' ? categoryId.trim() : null,
        typeof investmentCost === 'number' ? investmentCost : null,
      ),
    ];
  }
}
