export class FilterCustomersDto {
  private constructor(
    public readonly search?: string,
    public readonly isActive?: boolean,
  ) {}

  static create(object: Record<string, unknown>): [string?, FilterCustomersDto?] {
    const { search, isActive } = object;
    return [
      undefined,
      new FilterCustomersDto(
        search ? String(search).trim() : undefined,
        isActive !== undefined ? isActive === 'true' || isActive === true : undefined,
      ),
    ];
  }
}
