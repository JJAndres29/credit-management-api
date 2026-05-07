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

    if (description !== undefined && description !== null) {
      if (typeof description !== 'string' || description.trim().length === 0) {
        return ['La descripción debe ser un texto no vacío'];
      }
      if ((description as string).trim().length > 2000) {
        return ['La descripción no puede superar los 2000 caracteres'];
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
