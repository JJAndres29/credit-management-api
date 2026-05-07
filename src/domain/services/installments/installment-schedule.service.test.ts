/**
 * Tests — E6-T1: InstallmentScheduleService
 *
 * Caja blanca del algoritmo "Reduce Plazo":
 *   - Pago exacto → cuotas cubiertas marcadas PAID.
 *   - Sobrepago → sobrante va a la ÚLTIMA cuota (no a la siguiente).
 *   - Subpago → primera cuota PARTIAL/OVERDUE según fecha.
 *   - initialPayment → se descuenta del available antes del cálculo FIFO.
 *   - Fechas: MONTHLY, BIWEEKLY y WEEKLY generadas correctamente.
 *
 * "today" es inyectable — todos los tests usan May 7, 2026 como fecha fija.
 */

import { InstallmentScheduleService, InstallmentSaleInput } from './installment-schedule.service';
import { InstallmentFrequency } from '../../entities/sale.entity';

// ─── Fecha fija ───────────────────────────────────────────────────────────────

/** May 7, 2026 (midnight local) */
const TODAY = new Date(2026, 4, 7);

// ─── Factory ─────────────────────────────────────────────────────────────────

function makeSale(overrides: Partial<InstallmentSaleInput> = {}): InstallmentSaleInput {
  return {
    id: 'sale-1',
    saleNumber: 1001,
    clientId: 'client-1',
    total: 600,
    // Jan 1 2026 → collectionDay=15 → dues: Jan 15, Feb 15, Mar 15, Apr 15, May 15, Jun 15
    createdAt: new Date(2026, 0, 1),
    installmentsCount: 6,
    installmentAmount: 100,
    collectionDay: 15,
    collectionDay2: null,
    frequency: InstallmentFrequency.MONTHLY,
    initialPayment: null,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('InstallmentScheduleService', () => {
  const svc = new InstallmentScheduleService();

  // ── Sin pagos ───────────────────────────────────────────────────────────────
  describe('sin pagos', () => {
    it('genera el número correcto de cuotas', () => {
      expect(svc.compute(makeSale(), [], TODAY).installments).toHaveLength(6);
    });

    it('cuotas anteriores a today son OVERDUE', () => {
      // Jan 15, Feb 15, Mar 15, Apr 15 → todas antes de May 7
      const { installments } = svc.compute(makeSale(), [], TODAY);
      expect(installments[0].status).toBe('OVERDUE'); // Jan 15
      expect(installments[1].status).toBe('OVERDUE'); // Feb 15
      expect(installments[2].status).toBe('OVERDUE'); // Mar 15
      expect(installments[3].status).toBe('OVERDUE'); // Apr 15
    });

    it('cuotas posteriores a today son PENDING', () => {
      const { installments } = svc.compute(makeSale(), [], TODAY);
      expect(installments[4].status).toBe('PENDING'); // May 15
      expect(installments[5].status).toBe('PENDING'); // Jun 15
    });

    it('daysOverdue se calcula correctamente para cuotas vencidas', () => {
      // Apr 15 → 22 días antes de May 7
      const { installments } = svc.compute(makeSale(), [], TODAY);
      expect(installments[3].daysOverdue).toBe(22);
    });

    it('PENDING tiene daysOverdue = 0', () => {
      const { installments } = svc.compute(makeSale(), [], TODAY);
      expect(installments[4].daysOverdue).toBe(0);
      expect(installments[5].daysOverdue).toBe(0);
    });

    it('remainingAmount es igual a expectedAmount cuando no hay pagos', () => {
      const { installments } = svc.compute(makeSale(), [], TODAY);
      for (const inst of installments) {
        expect(inst.paidAmount).toBe(0);
        expect(inst.remainingAmount).toBe(inst.expectedAmount);
      }
    });
  });

  // ── Pago exacto ─────────────────────────────────────────────────────────────
  describe('pago exacto de 1 cuota', () => {
    it('primera cuota es PAID con paidAmount=100 y remainingAmount=0', () => {
      const { installments } = svc.compute(makeSale(), [{ amount: 100 }], TODAY);
      expect(installments[0].status).toBe('PAID');
      expect(installments[0].paidAmount).toBe(100);
      expect(installments[0].remainingAmount).toBe(0);
    });

    it('cuota 2 sigue siendo OVERDUE (no se afecta por el pago)', () => {
      const { installments } = svc.compute(makeSale(), [{ amount: 100 }], TODAY);
      expect(installments[1].status).toBe('OVERDUE');
    });

    it('pago que cubre 3 cuotas exactas → primeras 3 PAID', () => {
      const { installments } = svc.compute(makeSale(), [{ amount: 300 }], TODAY);
      expect(installments[0].status).toBe('PAID');
      expect(installments[1].status).toBe('PAID');
      expect(installments[2].status).toBe('PAID');
      // La cuota 4 (Apr 15) no está cubierta y está vencida
      expect(installments[3].status).toBe('OVERDUE');
    });

    it('pago exacto de todas las cuotas → todas PAID', () => {
      const { installments } = svc.compute(makeSale(), [{ amount: 600 }], TODAY);
      for (const inst of installments) {
        expect(inst.status).toBe('PAID');
      }
    });
  });

  // ── Sobrepago (Reduce Plazo) ─────────────────────────────────────────────────
  describe('sobrepago — algoritmo Reduce Plazo', () => {
    it('sobrante va a la ÚLTIMA cuota, no a la siguiente', () => {
      // Pago 150 → fullPaid=1, leftover=50 → cuota 6 (Jun 15) recibe sobrante
      const { installments } = svc.compute(makeSale(), [{ amount: 150 }], TODAY);
      expect(installments[0].status).toBe('PAID');
      expect(installments[5].paidAmount).toBe(50);
      expect(installments[5].remainingAmount).toBe(50);
      expect(installments[5].status).toBe('PARTIAL'); // Jun 15 > today
    });

    it('cuota intermedia (i=2..N-1) NO recibe el sobrante', () => {
      const { installments } = svc.compute(makeSale(), [{ amount: 150 }], TODAY);
      // Cuota 2 (Feb 15) y cuota 5 (May 15) no deben recibir sobrante
      expect(installments[1].paidAmount).toBe(0);
      expect(installments[4].paidAmount).toBe(0);
    });

    it('sobrepago de 2.5 cuotas → 2 PAID, última PARTIAL con sobrante', () => {
      // 250 → fullPaid=2, leftover=50
      const { installments } = svc.compute(makeSale(), [{ amount: 250 }], TODAY);
      expect(installments[0].status).toBe('PAID');
      expect(installments[1].status).toBe('PAID');
      expect(installments[5].paidAmount).toBe(50);
      expect(installments[5].status).toBe('PARTIAL');
    });
  });

  // ── Subpago (underpayment) ───────────────────────────────────────────────────
  describe('subpago — pago menor a 1 cuota', () => {
    it('primera cuota con dueDate futuro → PARTIAL', () => {
      // Sale creada May 6 → primera fecha de cobro: Jun 15 (futura)
      const recentSale = makeSale({ createdAt: new Date(2026, 4, 6) });
      const { installments } = svc.compute(recentSale, [{ amount: 50 }], TODAY);
      expect(installments[0].status).toBe('PARTIAL');
      expect(installments[0].paidAmount).toBe(50);
      expect(installments[0].remainingAmount).toBe(50);
    });

    it('primera cuota con dueDate pasado → OVERDUE (aunque tenga pago parcial)', () => {
      // Sale creada Jan 1 → primera cuota Jan 15 (pasada)
      const { installments } = svc.compute(makeSale(), [{ amount: 50 }], TODAY);
      // paidAmount=50 pero dueDate < today → OVERDUE
      expect(installments[0].status).toBe('OVERDUE');
    });
  });

  // ── initialPayment ───────────────────────────────────────────────────────────
  describe('initialPayment', () => {
    it('se descuenta del available antes del cálculo FIFO', () => {
      // initialPayment=50, payment=[150] → available = max(0, 150-50) = 100 → fullPaid=1, leftover=0
      const sale = makeSale({ initialPayment: 50 });
      const { installments } = svc.compute(sale, [{ amount: 150 }], TODAY);
      // Primera cuota pagada, no queda sobrante para la última
      expect(installments[0].status).toBe('PAID');
      expect(installments[5].paidAmount).toBe(0);
    });

    it('si el total de pagos < initialPayment → available = 0 → todas sin pago', () => {
      const sale = makeSale({ initialPayment: 200 });
      const { installments } = svc.compute(sale, [{ amount: 100 }], TODAY);
      // 100 < 200 → available = 0 → todas sin pago
      for (const inst of installments) {
        expect(inst.paidAmount).toBe(0);
      }
    });

    it('initialPayment se expone en el resultado del schedule', () => {
      const sale = makeSale({ initialPayment: 50 });
      const schedule = svc.compute(sale, [], TODAY);
      expect(schedule.initialPayment).toBe(50);
    });

    it('totalPaid incluye el initialPayment (es un pago real)', () => {
      const sale = makeSale({ initialPayment: 50 });
      const schedule = svc.compute(sale, [{ amount: 50 }, { amount: 100 }], TODAY);
      expect(schedule.totalPaid).toBe(150);
    });
  });

  // ── BIWEEKLY ─────────────────────────────────────────────────────────────────
  describe('BIWEEKLY — dos días de cobro por mes', () => {
    it('genera fechas alternadas entre collectionDay y collectionDay2', () => {
      // createdAt Jan 1 → fechas: Jan 5, Jan 20, Feb 5, Feb 20, Mar 5, Mar 20
      const sale = makeSale({
        frequency: InstallmentFrequency.BIWEEKLY,
        installmentsCount: 6,
        collectionDay: 5,
        collectionDay2: 20,
        createdAt: new Date(2026, 0, 1),
      });
      const { installments } = svc.compute(sale, [], TODAY);
      const dates = installments.map((i) => i.dueDate);

      expect(dates[0]).toEqual(new Date(2026, 0, 5));  // Jan 5
      expect(dates[1]).toEqual(new Date(2026, 0, 20)); // Jan 20
      expect(dates[2]).toEqual(new Date(2026, 1, 5));  // Feb 5
      expect(dates[3]).toEqual(new Date(2026, 1, 20)); // Feb 20
      expect(dates[4]).toEqual(new Date(2026, 2, 5));  // Mar 5
      expect(dates[5]).toEqual(new Date(2026, 2, 20)); // Mar 20
    });
  });

  // ── WEEKLY ───────────────────────────────────────────────────────────────────
  describe('WEEKLY — día de la semana', () => {
    it('genera fechas cada 7 días a partir del primer día correcto', () => {
      // createdAt Jan 1 2026 (jueves). collectionDay=3 (miércoles)
      // Primer miércoles después de Jan 1 = Jan 7
      const sale = makeSale({
        frequency: InstallmentFrequency.WEEKLY,
        installmentsCount: 3,
        collectionDay: 3, // miércoles (1=lun, 7=dom)
        collectionDay2: null,
        createdAt: new Date(2026, 0, 1),
      });
      const { installments } = svc.compute(sale, [], TODAY);
      const dates = installments.map((i) => i.dueDate);

      expect(dates[0]).toEqual(new Date(2026, 0, 7));  // Jan 7 (mié)
      expect(dates[1]).toEqual(new Date(2026, 0, 14)); // Jan 14 (mié)
      expect(dates[2]).toEqual(new Date(2026, 0, 21)); // Jan 21 (mié)
    });

    it('collectionDay=7 (domingo) se convierte correctamente a JS getDay()=0', () => {
      // Jan 1 2026 es jueves. Primer domingo después = Jan 4
      const sale = makeSale({
        frequency: InstallmentFrequency.WEEKLY,
        installmentsCount: 2,
        collectionDay: 7,
        collectionDay2: null,
        createdAt: new Date(2026, 0, 1),
      });
      const { installments } = svc.compute(sale, [], TODAY);
      expect(installments[0].dueDate).toEqual(new Date(2026, 0, 4)); // Jan 4 (dom)
      expect(installments[1].dueDate).toEqual(new Date(2026, 0, 11)); // Jan 11 (dom)
    });
  });

  // ── Metadatos del schedule ───────────────────────────────────────────────────
  describe('metadatos del resultado', () => {
    it('saleId, saleNumber y clientId se propagan al schedule', () => {
      const schedule = svc.compute(
        makeSale({ id: 'x-sale', saleNumber: 42, clientId: 'x-client' }),
        [],
        TODAY,
      );
      expect(schedule.saleId).toBe('x-sale');
      expect(schedule.saleNumber).toBe(42);
      expect(schedule.clientId).toBe('x-client');
    });

    it('totalPaid suma todos los pagos recibidos', () => {
      const schedule = svc.compute(makeSale(), [{ amount: 100 }, { amount: 150 }], TODAY);
      expect(schedule.totalPaid).toBe(250);
    });

    it('usa installmentAmount de la venta si está disponible', () => {
      const schedule = svc.compute(makeSale({ installmentAmount: 100 }), [], TODAY);
      expect(schedule.installmentAmount).toBe(100);
    });

    it('fallback a Math.ceil(total/count) si installmentAmount es null', () => {
      // Math.ceil(301/3) = 101
      const schedule = svc.compute(
        makeSale({ installmentAmount: null, total: 301, installmentsCount: 3 }),
        [],
        TODAY,
      );
      expect(schedule.installmentAmount).toBe(101);
    });

    it('índice de cada cuota es 1-based', () => {
      const { installments } = svc.compute(makeSale(), [], TODAY);
      installments.forEach((inst, idx) => {
        expect(inst.index).toBe(idx + 1);
      });
    });
  });
});
