export class CreateCategoryDto {
  private constructor(public readonly name: string) {}

  static create(object: Record<string, unknown>): [string?, CreateCategoryDto?] {
    const { name } = object;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return ['El nombre de la categoría es requerido y debe tener al menos 2 caracteres'];
    }

    return [undefined, new CreateCategoryDto(name.trim())];
  }
}
