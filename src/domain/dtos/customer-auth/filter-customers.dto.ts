const MAX_SEARCH_LENGTH = 100;

export class FilterCustomersDto {
  private constructor(
    public readonly search?: string,
    public readonly isActive?: boolean,
  ) {}

  static create(object: Record<string, unknown>): [string?, FilterCustomersDto?] {
    const { search, isActive } = object;
    if (search !== undefined && String(search).trim().length > MAX_SEARCH_LENGTH) {
      return [`search no puede superar los ${MAX_SEARCH_LENGTH} caracteres`];
    }
    if (isActive !== undefined && isActive !== 'true' && isActive !== 'false' && typeof isActive !== 'boolean') {
      return ['isActive debe ser true o false'];
    }
    return [
      undefined,
      new FilterCustomersDto(
        search ? String(search).trim() : undefined,
        isActive !== undefined ? isActive === 'true' || isActive === true : undefined,
      ),
    ];
  }
}
