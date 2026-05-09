const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;

export class UpdateProductDto {
  private constructor(
    public readonly name: string | undefined,
    public readonly description: string | null | undefined,
    public readonly categoryId: string | null | undefined,
    public readonly investmentCost: number | null | undefined,
  ) {}

  static create(object: Record<string, unknown>): [string?, UpdateProductDto?] {
    const { name, description, categoryId, investmentCost } = object;

    if (name !== undefined && (typeof name !== 'string' || name.trim().length < 2)) {
      return ['El nombre debe tener al menos 2 caracteres'];
    }
    if (typeof name === 'string' && name.trim().length > MAX_NAME_LENGTH) {
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

    if (name === undefined && description === undefined && categoryId === undefined && investmentCost === undefined) {
      return ['Debe enviar al menos un campo para actualizar'];
    }

    return [
      undefined,
      new UpdateProductDto(
        typeof name === 'string' ? name.trim() : undefined,
        description === null ? null : typeof description === 'string' ? description.trim() : undefined,
        categoryId === null ? null : typeof categoryId === 'string' ? categoryId.trim() : undefined,
        investmentCost === null ? null : typeof investmentCost === 'number' ? investmentCost : undefined,
      ),
    ];
  }
}
