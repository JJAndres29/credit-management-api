export class PaginationDto {
  private constructor(
    public readonly page: number,
    public readonly limit: number,
  ) {}

  get skip(): number {
    return (this.page - 1) * this.limit;
  }

  static create(object: Record<string, unknown>): [string?, PaginationDto?] {
    const { page = '1', limit = '20' } = object;

    const pageNum = parseInt(String(page), 10);
    const limitNum = parseInt(String(limit), 10);

    if (isNaN(pageNum) || pageNum < 1) {
      return ['page debe ser un entero mayor a 0'];
    }
    if (isNaN(limitNum) || limitNum < 1) {
      return ['limit debe ser un entero mayor a 0'];
    }
    if (limitNum > 100) {
      return ['limit no puede exceder 100'];
    }

    return [undefined, new PaginationDto(pageNum, limitNum)];
  }
}
