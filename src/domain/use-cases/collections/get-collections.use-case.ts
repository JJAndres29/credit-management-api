import { SaleRepository } from '../../repositories/sale.repository';
import { PaymentRepository } from '../../repositories/payment.repository';
import { ClientRepository } from '../../repositories/client.repository';
import { InstallmentScheduleService, InstallmentStatus } from '../../services/installments';
import { FilterInstallmentsDto } from '../../dtos/collections';
import { PaginationDto } from '../../dtos/shared';
import { PaginatedResult } from '../../types/paginated.type';

export interface CollectionInstallmentItem {
  saleId: string;
  saleNumber: number;
  clientId: string;
  clientName: string;
  installmentIndex: number;
  dueDate: Date;
  expectedAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: InstallmentStatus;
  daysOverdue: number;
}

/**
 * Lista todas las cuotas de ventas CREDIT activas (PENDING/PARTIAL con plan de cuotas),
 * calcula el estado real de cada cuota con FIFO carryover y aplica filtros.
 *
 * Estrategia anti-N+1:
 *   - Una sola query para todas las ventas activas (filtrada por clientId si aplica).
 *   - Una sola query bulk para todos los pagos de esas ventas (findBySaleIds).
 *   - Una query paralela por cliente único para obtener nombres (Promise.all).
 *   - El cálculo de schedule y la paginación se hacen en memoria.
 *
 * TODO: Si el dataset de ventas activas supera ~5k, migrar a filtrado parcial en SQL
 *       mediante un nuevo método SaleRepository.findActiveCreditSales con filtros SQL.
 */
export class GetCollectionsUseCase {
  constructor(
    private readonly saleRepository: SaleRepository,
    private readonly paymentRepository: PaymentRepository,
    private readonly clientRepository: ClientRepository,
    private readonly scheduleService: InstallmentScheduleService,
  ) {}

  async execute(
    pagination: PaginationDto,
    filters?: FilterInstallmentsDto,
  ): Promise<PaginatedResult<CollectionInstallmentItem>> {
    const activeFilters = filters ?? ({} as FilterInstallmentsDto);
    // 1. Cargar ventas CREDIT activas (PENDING/PARTIAL con plan de cuotas)
    const sales = await this.saleRepository.findActiveCreditSales(activeFilters.clientId);

    if (sales.length === 0) {
      return {
        data: [],
        pagination: {
          total: 0,
          page: pagination.page,
          limit: pagination.limit,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      };
    }

    // 2. Bulk-load de pagos en una sola query para todas las ventas
    const saleIds = sales.map((s) => s.id);
    const allPayments = await this.paymentRepository.findBySaleIds(saleIds);

    // 3. Agrupar pagos por saleId para acceso O(1)
    const paymentsBySaleId = new Map<string, { amount: number }[]>();
    for (const payment of allPayments) {
      if (!payment.saleId) continue;
      const existing = paymentsBySaleId.get(payment.saleId);
      if (existing) {
        existing.push({ amount: payment.amount });
      } else {
        paymentsBySaleId.set(payment.saleId, [{ amount: payment.amount }]);
      }
    }

    // 4. Resolver nombres de clientes (un lookup por clientId único, en paralelo)
    const uniqueClientIds = [...new Set(sales.map((s) => s.clientId))];
    const clientResults = await Promise.all(
      uniqueClientIds.map((id) => this.clientRepository.findById(id)),
    );
    const clientNameMap = new Map<string, string>();
    for (let i = 0; i < uniqueClientIds.length; i++) {
      const client = clientResults[i];
      if (client) clientNameMap.set(uniqueClientIds[i], client.name);
    }

    // 5. Calcular schedule de cada venta y aplanar cuotas
    const items: CollectionInstallmentItem[] = [];

    for (const sale of sales) {
      if (!sale.installmentsCount || !sale.frequency) continue;

      const salePayments = paymentsBySaleId.get(sale.id) ?? [];
      // The null guard above ensures installmentsCount and frequency are present;
      // spread with assertion to satisfy InstallmentSaleInput's non-nullable installmentsCount.
      const schedule = this.scheduleService.compute(
        { ...sale, installmentsCount: sale.installmentsCount! },
        salePayments,
      );

      for (const inst of schedule.installments) {
        // Aplicar filtro de status
        if (activeFilters.status && inst.status !== activeFilters.status) continue;

        // Aplicar filtros de fecha
        if (activeFilters.dueFrom && inst.dueDate < activeFilters.dueFrom) continue;
        if (activeFilters.dueTo && inst.dueDate > activeFilters.dueTo) continue;

        items.push({
          saleId: sale.id,
          saleNumber: sale.saleNumber,
          clientId: sale.clientId,
          clientName: clientNameMap.get(sale.clientId) ?? `Cliente ${sale.clientId.slice(0, 8)}`,
          installmentIndex: inst.index,
          dueDate: inst.dueDate,
          expectedAmount: inst.expectedAmount,
          paidAmount: inst.paidAmount,
          remainingAmount: inst.remainingAmount,
          status: inst.status,
          daysOverdue: inst.daysOverdue,
        });
      }
    }

    // 6. Ordenar por fecha de vencimiento ascendente (más antiguas primero)
    items.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

    // 7. Paginación en memoria
    const total = items.length;
    const start = pagination.skip;
    const end = start + pagination.limit;

    return {
      data: items.slice(start, end),
      pagination: {
        total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(total / pagination.limit) || 0,
        hasNextPage: end < total,
        hasPrevPage: pagination.page > 1,
      },
    };
  }
}
