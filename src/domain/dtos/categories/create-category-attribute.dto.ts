export class CreateCategoryAttributeDto {
  private constructor(public readonly name: string) {}

  static create(object: Record<string, unknown>): [string?, CreateCategoryAttributeDto?] {
    const { name } = object;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return ['El nombre del atributo es requerido y debe tener al menos 2 caracteres'];
    }

    return [undefined, new CreateCategoryAttributeDto(name.trim())];
  }
}
