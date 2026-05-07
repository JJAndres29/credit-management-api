import { InstallmentFrequency } from '../../entities/sale.entity';

export type InstallmentStatus = 'PAID' | 'PARTIAL' | 'PENDING' | 'OVERDUE';

export interface Installment {
  index: number;
  dueDate: Date;
  expectedAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: InstallmentStatus;
  daysOverdue: number;
}

export interface InstallmentSchedule {
  saleId: string;
  saleNumber: number;
  clientId: string;
  installmentsCount: number;
  installmentAmount: number;
  initialPayment: number;
  totalPaid: number;
  installments: Installment[];
}

/**
 * Minimal shape a sale must expose so the schedule service can work
 * with both SaleEntity and DashboardActiveCreditSale.
 */
export interface InstallmentSaleInput {
  id: string;
  saleNumber: number;
  clientId: string;
  total: number;
  createdAt: Date;
  installmentsCount: number;
  installmentAmount: number | null;
  collectionDay: number | null;
  collectionDay2: number | null;
  frequency: InstallmentFrequency | null;
  initialPayment: number | null;
}

/**
 * Domain Service: materializa el "schedule de cuotas" de una venta a crédito.
 *
 * Algoritmo Reduce Plazo:
 *   El sobrante de un pago que excede una cuota completa se aplica a la ÚLTIMA
 *   cuota, reduciendo el plazo. El cliente sigue pagando las cuotas intermedias
 *   en sus fechas normales — no se "salta" la siguiente cuota.
 *
 *   Caso base: pago cubre exactamente N cuotas enteras
 *     → cuotas 1..N: PAID, sin sobrante.
 *
 *   Caso overpayment (pago > k * installmentAmount):
 *     → cuotas 1..k: PAID (cubiertas desde el inicio)
 *     → cuota N (última): PARTIAL con paidAmount = sobrante, remainingAmount reducido
 *     → cuotas (k+1)..(N-1): PENDING/OVERDUE según dueDate
 *
 *   Caso underpayment (pago < installmentAmount — no cubre ni una cuota completa):
 *     → cuota 1 (actual): PARTIAL con el monto pagado (FIFO para cuota actual)
 *     → cuotas 2..N: PENDING/OVERDUE
 *
 *   Estado de cada cuota:
 *     paidAmount >= installmentAmount → PAID
 *     paidAmount > 0                 → PARTIAL
 *     dueDate < today                → OVERDUE
 *     dueDate >= today               → PENDING
 *
 * Reglas de fecha por frecuencia:
 *   MONTHLY/BIWEEKLY: collectionDay(s) son días del mes (1-31), se generan
 *                     iterando mes a mes después de createdAt.
 *   WEEKLY:           collectionDay es día de la semana (1=lunes, 7=domingo),
 *                     se generan semanalmente.
 *
 * El parámetro `today` es inyectable para facilitar tests.
 * Por defecto se calcula en la zona horaria America/Bogota.
 *
 * Sin dependencias de infraestructura — cumple Regla de Cero Acoplamiento.
 */
export class InstallmentScheduleService {
  compute(
    sale: InstallmentSaleInput,
    payments: { amount: number }[],
    today: Date = InstallmentScheduleService.todayBogota(),
  ): InstallmentSchedule {
    const installmentAmount =
      sale.installmentAmount ?? Math.ceil(sale.total / sale.installmentsCount);
    const initialPayment = Number(sale.initialPayment ?? 0);
    const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const N = sale.installmentsCount;

    // Available after discounting the initial down-payment
    const available = Math.max(0, totalPaid - initialPayment);

    // How many complete installments are covered from the start
    const fullPaid = Math.min(Math.floor(available / installmentAmount), N);
    // Leftover after covering full installments (goes to reduce the last one)
    const leftover = Math.round((available - fullPaid * installmentAmount) * 100) / 100;

    const after = new Date(sale.createdAt);
    after.setHours(0, 0, 0, 0);

    const dueDates = this.buildDueDates(sale, after, N);

    const installments: Installment[] = dueDates.map((dueDate, idx) => {
      const i = idx + 1; // 1-based index

      let paidAmount: number;

      if (i <= fullPaid) {
        // Fully covered from the start
        paidAmount = installmentAmount;
      } else if (fullPaid === 0 && i === 1 && leftover > 0) {
        // Underpayment: didn't cover even one full installment → apply to cuota 1 (current)
        paidAmount = leftover;
      } else if (i === N && leftover > 0 && fullPaid > 0) {
        // Overpayment: sobrante reduces the LAST installment
        paidAmount = leftover;
      } else {
        paidAmount = 0;
      }

      const roundedPaid = Math.round(paidAmount * 100) / 100;
      const remainingAmount = Math.round((installmentAmount - roundedPaid) * 100) / 100;

      let status: InstallmentStatus;
      if (roundedPaid >= installmentAmount) {
        status = 'PAID';
      } else if (roundedPaid > 0) {
        status = dueDate < today ? 'OVERDUE' : 'PARTIAL';
      } else if (dueDate < today) {
        status = 'OVERDUE';
      } else {
        status = 'PENDING';
      }

      const daysOverdue =
        status === 'OVERDUE'
          ? Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
          : 0;

      return {
        index: i,
        dueDate,
        expectedAmount: installmentAmount,
        paidAmount: roundedPaid,
        remainingAmount,
        status,
        daysOverdue,
      };
    });

    return {
      saleId: sale.id,
      saleNumber: sale.saleNumber,
      clientId: sale.clientId,
      installmentsCount: sale.installmentsCount,
      installmentAmount,
      initialPayment,
      totalPaid,
      installments,
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private buildDueDates(sale: InstallmentSaleInput, after: Date, count: number): Date[] {
    if (sale.frequency === InstallmentFrequency.WEEKLY) {
      return this.buildWeeklyDates(sale.collectionDay ?? 1, after, count);
    }

    // MONTHLY and BIWEEKLY: collectionDay(s) are day-of-month (1-31)
    const days = sale.collectionDay2
      ? [sale.collectionDay!, sale.collectionDay2]
      : [sale.collectionDay!];

    return this.buildMonthlyDates(days, after, count);
  }

  /**
   * Genera fechas mensuales/quincenales partiendo de los días del mes dados.
   * Replica la lógica de buildDatesFromDays del frontend.
   */
  private buildMonthlyDates(days: number[], after: Date, count: number): Date[] {
    const sorted = [...days].sort((a, b) => a - b);
    const result: Date[] = [];
    let year = after.getFullYear();
    let month = after.getMonth();

    while (result.length < count) {
      for (const day of sorted) {
        const candidate = new Date(year, month, day);
        if (candidate > after) {
          result.push(candidate);
          if (result.length >= count) break;
        }
      }
      month++;
      if (month > 11) {
        month = 0;
        year++;
      }
    }

    return result;
  }

  /**
   * Genera fechas semanales a partir del primer día de la semana (1=lunes, 7=domingo)
   * que caiga después de `after`.
   */
  private buildWeeklyDates(collectionDayBogota: number, after: Date, count: number): Date[] {
    // Convert 1-7 (Mon-Sun) to JS 0-6 (Sun-Sat)
    const targetDayJS = collectionDayBogota === 7 ? 0 : collectionDayBogota;

    const result: Date[] = [];
    const cursor = new Date(after);
    cursor.setDate(cursor.getDate() + 1);

    while (cursor.getDay() !== targetDayJS) {
      cursor.setDate(cursor.getDate() + 1);
    }

    for (let i = 0; i < count; i++) {
      result.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 7);
    }

    return result;
  }

  /** Returns today's date (midnight) in the America/Bogota timezone. */
  static todayBogota(): Date {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);

    const year = Number(parts.find((p) => p.type === 'year')!.value);
    const month = Number(parts.find((p) => p.type === 'month')!.value);
    const day = Number(parts.find((p) => p.type === 'day')!.value);

    return new Date(year, month - 1, day);
  }
}
