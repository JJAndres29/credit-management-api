export class AssignProductAttributesDto {
  private constructor(public readonly valueIds: string[]) {}

  static create(object: Record<string, unknown>): [string?, AssignProductAttributesDto?] {
    const { valueIds } = object;

    if (!Array.isArray(valueIds) || valueIds.length === 0) {
      return ['valueIds debe ser un arreglo con al menos un id'];
    }

    const invalid = valueIds.some((id) => typeof id !== 'string' || id.trim().length === 0);
    if (invalid) return ['Todos los valueIds deben ser strings válidos'];

    const deduped = Array.from(new Set(valueIds.map((id) => id.trim())));
    return [undefined, new AssignProductAttributesDto(deduped)];
  }
}
