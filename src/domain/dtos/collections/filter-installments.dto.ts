import { InstallmentStatus } from '../../services/installments';

const VALID_STATUSES: InstallmentStatus[] = ['PENDING', 'PARTIAL', 'OVERDUE', 'PAID'];

export class FilterInstallmentsDto {
  private constructor(
    public readonly status?: InstallmentStatus,
    public readonly clientId?: string,
    public readonly dueFrom?: Date,
    public readonly dueTo?: Date,
  ) {}

  static create(object: Record<string, unknown>): [string?, FilterInstallmentsDto?] {
    const { status, clientId, dueFrom, dueTo, month } = object;

    if (status !== undefined && !VALID_STATUSES.includes(status as InstallmentStatus)) {
      return ['status debe ser PENDING, PARTIAL, OVERDUE o PAID'];
    }
    if (clientId !== undefined && (typeof clientId !== 'string' || clientId.trim().length === 0)) {
      return ['clientId debe ser una cadena de texto no vacía'];
    }

    let parsedDueFrom: Date | undefined;
    let parsedDueTo: Date | undefined;

    if (month !== undefined) {
      const monthStr = String(month);
      if (!/^\d{4}-\d{2}$/.test(monthStr)) {
        return ['month debe tener formato YYYY-MM (ej. 2026-05)'];
      }
      const [year, m] = monthStr.split('-').map(Number);
      parsedDueFrom = new Date(year, m - 1, 1);
      parsedDueTo = new Date(year, m, 0, 23, 59, 59, 999);
    } else {
      if (dueFrom !== undefined) {
        parsedDueFrom = new Date(String(dueFrom));
        if (isNaN(parsedDueFrom.getTime())) {
          return ['dueFrom debe ser una fecha ISO 8601 válida'];
        }
      }
      if (dueTo !== undefined) {
        parsedDueTo = new Date(String(dueTo));
        if (isNaN(parsedDueTo.getTime())) {
          return ['dueTo debe ser una fecha ISO 8601 válida'];
        }
        parsedDueTo.setHours(23, 59, 59, 999);
      }
    }

    return [
      undefined,
      new FilterInstallmentsDto(
        status as InstallmentStatus | undefined,
        typeof clientId === 'string' ? clientId.trim() : undefined,
        parsedDueFrom,
        parsedDueTo,
      ),
    ];
  }
}
