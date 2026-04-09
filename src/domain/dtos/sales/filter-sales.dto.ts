import { SaleType, SaleStatus } from '../../entities';

export class FilterSalesDto {
  private constructor(
    public readonly clientId?: string,
    public readonly type?: SaleType,
    public readonly status?: SaleStatus,
    public readonly dateFrom?: Date,
    public readonly dateTo?: Date,
  ) {}

  static create(object: Record<string, unknown>): [string?, FilterSalesDto?] {
    const { clientId, type, status, dateFrom, dateTo } = object;

    if (clientId !== undefined && typeof clientId !== 'string') {
      return ['clientId debe ser una cadena de texto'];
    }

    if (type !== undefined && !Object.values(SaleType).includes(type as SaleType)) {
      return [`type debe ser uno de: ${Object.values(SaleType).join(', ')}`];
    }

    if (status !== undefined && !Object.values(SaleStatus).includes(status as SaleStatus)) {
      return [`status debe ser uno de: ${Object.values(SaleStatus).join(', ')}`];
    }

    let dateFromDate: Date | undefined;
    if (dateFrom !== undefined) {
      dateFromDate = new Date(String(dateFrom));
      if (isNaN(dateFromDate.getTime())) {
        return ['dateFrom no tiene un formato de fecha válido (ISO 8601 recomendado)'];
      }
    }

    let dateToDate: Date | undefined;
    if (dateTo !== undefined) {
      dateToDate = new Date(String(dateTo));
      if (isNaN(dateToDate.getTime())) {
        return ['dateTo no tiene un formato de fecha válido (ISO 8601 recomendado)'];
      }
      // Set time to end of day so dateTo is inclusive
      dateToDate.setHours(23, 59, 59, 999);
    }

    if (dateFromDate && dateToDate && dateFromDate > dateToDate) {
      return ['dateFrom no puede ser posterior a dateTo'];
    }

    return [
      undefined,
      new FilterSalesDto(
        clientId as string | undefined,
        type as SaleType | undefined,
        status as SaleStatus | undefined,
        dateFromDate,
        dateToDate,
      ),
    ];
  }
}
