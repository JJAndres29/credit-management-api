export class CreateAttributeValueDto {
  private constructor(public readonly value: string) {}

  static create(object: Record<string, unknown>): [string?, CreateAttributeValueDto?] {
    const { value } = object;

    if (!value || typeof value !== 'string' || value.trim().length < 1) {
      return ['El valor es requerido'];
    }

    return [undefined, new CreateAttributeValueDto(value.trim())];
  }
}
