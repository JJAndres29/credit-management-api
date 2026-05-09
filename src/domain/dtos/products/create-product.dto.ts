const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;

export class CreateProductDto {
  private constructor(
    public readonly name: string,
    public readonly description: string | null,
    public readonly stock: number,
    public readonly categoryId: string | null,
    public readonly investmentCost: number | null,
  ) {}

  static create(object: Record<string, unknown>): [string?, CreateProductDto?] {
    const { name, description, stock, categoryId, investmentCost } = object;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return ['El nombre es requerido y debe tener al menos 2 caracteres'];
    }
    if (name.trim().length > MAX_NAME_LENGTH) {
      return [`El nombre no puede superar los ${MAX_NAME_LENGTH} caracteres`];
    }

    if (description !== undefined && description !== null) {
      if (typeof description !== 'string' || description.trim().length === 0) {
        return ['La descripción debe ser un texto no vacío'];
      }
      if ((description as string).trim().length > MAX_DESCRIPTION_LENGTH) {
        return [`La descripción no puede superar los ${MAX_DESCRIPTION_LENGTH} caracteres`];
      }
    }

    if (stock !== undefined && stock !== null) {
      if (typeof stock !== 'number' || !Number.isInteger(stock) || stock < 0) {
        return ['El stock debe ser un número entero mayor o igual a 0'];
      }
    }

    if (categoryId !== undefined && categoryId !== null) {
      if (typeof categoryId !== 'string' || !UUID_V4.test(categoryId.trim())) {
        return ['El categoryId debe ser un UUID v4 válido'];
      }
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
        typeof description === 'string' ? description.trim() : null,
        typeof stock === 'number' ? stock : 0,
        typeof categoryId === 'string' ? categoryId.trim() : null,
        typeof investmentCost === 'number' ? investmentCost : null,
      ),
    ];
  }
}
