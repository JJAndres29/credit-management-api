import { AuditAction } from '../../entities';

export class FilterAuditLogsDto {
  private constructor(
    public readonly clientId?: string,
    public readonly userId?: string,
    public readonly action?: string,
    public readonly dateFrom?: Date,
    public readonly dateTo?: Date,
  ) {}

  static create(object: Record<string, unknown>): [string?, FilterAuditLogsDto?] {
    const { clientId, userId, action, dateFrom, dateTo } = object;

    if (clientId !== undefined && typeof clientId !== 'string') {
      return ['clientId debe ser una cadena de texto'];
    }

    if (userId !== undefined && typeof userId !== 'string') {
      return ['userId debe ser una cadena de texto'];
    }

    if (action !== undefined && !Object.values(AuditAction).includes(action as AuditAction)) {
      return [`action debe ser uno de: ${Object.values(AuditAction).join(', ')}`];
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
      new FilterAuditLogsDto(
        clientId as string | undefined,
        userId as string | undefined,
        action as string | undefined,
        dateFromDate,
        dateToDate,
      ),
    ];
  }
}
