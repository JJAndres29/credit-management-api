export class ReplaceProductAttributesDto {
  private constructor(public readonly valueIds: string[]) {}

  static create(object: Record<string, unknown>): [string?, ReplaceProductAttributesDto?] {
    const { valueIds } = object;

    if (!Array.isArray(valueIds)) {
      return ['valueIds debe ser un arreglo'];
    }

    const invalid = valueIds.some((id) => typeof id !== 'string' || id.trim().length === 0);
    if (invalid) return ['Todos los valueIds deben ser strings válidos'];

    const deduped = Array.from(new Set(valueIds.map((id) => id.trim())));
    return [undefined, new ReplaceProductAttributesDto(deduped)];
  }
}
