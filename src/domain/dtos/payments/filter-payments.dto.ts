export class FilterPaymentsDto {
  private constructor(
    public readonly clientId?: string,
    public readonly saleId?: string,
    public readonly dateFrom?: Date,
    public readonly dateTo?: Date,
  ) {}

  static create(object: Record<string, unknown>): [string?, FilterPaymentsDto?] {
    const { clientId, saleId, dateFrom, dateTo } = object;

    if (clientId !== undefined && typeof clientId !== 'string') {
      return ['clientId debe ser una cadena de texto'];
    }

    if (saleId !== undefined && typeof saleId !== 'string') {
      return ['saleId debe ser una cadena de texto'];
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
      dateToDate.setHours(23, 59, 59, 999);
    }

    if (dateFromDate && dateToDate && dateFromDate > dateToDate) {
      return ['dateFrom no puede ser posterior a dateTo'];
    }

    return [
      undefined,
      new FilterPaymentsDto(
        clientId as string | undefined,
        saleId as string | undefined,
        dateFromDate,
        dateToDate,
      ),
    ];
  }
}
