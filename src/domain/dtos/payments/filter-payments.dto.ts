/** YYYY-MM regex — se acepta como atajo para dateFrom/dateTo de un mes completo. */
const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class FilterPaymentsDto {
  private constructor(
    public readonly clientId?: string,
    public readonly saleId?: string,
    public readonly dateFrom?: Date,
    public readonly dateTo?: Date,
  ) {}

  static create(object: Record<string, unknown>): [string?, FilterPaymentsDto?] {
    const { clientId, saleId, dateFrom, dateTo, month } = object;

    if (clientId !== undefined && typeof clientId !== 'string') {
      return ['clientId debe ser una cadena de texto'];
    }
    if (typeof clientId === 'string' && !UUID_V4.test(clientId.trim())) {
      return ['clientId debe ser un UUID v4 válido'];
    }

    if (saleId !== undefined && typeof saleId !== 'string') {
      return ['saleId debe ser una cadena de texto'];
    }
    if (typeof saleId === 'string' && !UUID_V4.test(saleId.trim())) {
      return ['saleId debe ser un UUID v4 válido'];
    }

    // month=YYYY-MM expands to dateFrom (1st) and dateTo (last day at 23:59:59).
    // Takes precedence over explicit dateFrom/dateTo when provided.
    if (month !== undefined) {
      if (typeof month !== 'string' || !MONTH_REGEX.test(month)) {
        return ['month debe tener formato YYYY-MM (ej. 2026-05)'];
      }
      const [y, m] = month.split('-').map(Number);
      const from = new Date(y, m - 1, 1);
      const to = new Date(y, m, 0, 23, 59, 59, 999); // último día del mes
      return [
        undefined,
        new FilterPaymentsDto(
          typeof clientId === 'string' ? clientId.trim() : undefined,
          typeof saleId === 'string' ? saleId.trim() : undefined,
          from,
          to,
        ),
      ];
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
        typeof clientId === 'string' ? clientId.trim() : undefined,
        typeof saleId === 'string' ? saleId.trim() : undefined,
        dateFromDate,
        dateToDate,
      ),
    ];
  }
}
