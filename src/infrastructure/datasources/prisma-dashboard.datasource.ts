import { prisma } from '../../config/prisma';
import {
  DashboardDatasource,
  DashboardRawMetrics,
  DashboardActiveCreditSale,
} from '../../domain/datasources/dashboard.datasource';
import { SaleStatus, SaleType } from '../../domain/entities';

export class PrismaDashboardDatasource implements DashboardDatasource {
  async getRawMetrics(monthStart: Date, monthEnd: Date): Promise<DashboardRawMetrics> {
    const monthFilter = { createdAt: { gte: monthStart, lte: monthEnd } };

    const [
      salesAgg,
      paymentsAgg,
      clientsAgg,
      cashSalesAgg,
      creditSalesAgg,
      salesGroupBy,
      recentSales,
      activeCreditSales,
    ] = await Promise.all([
      prisma.sale.aggregate({
        where: monthFilter,
        _sum: { total: true },
        _count: { _all: true },
      }),

      prisma.payment.aggregate({
        where: monthFilter,
        _sum: { amount: true },
      }),

      prisma.client.aggregate({
        where: { isActive: true },
        _sum: { balance: true },
        _count: { _all: true },
      }),

      // Ventas de contado del mes
      prisma.sale.aggregate({
        where: { ...monthFilter, type: SaleType.CASH },
        _sum: { total: true },
      }),

      // Ventas a crédito del mes
      prisma.sale.aggregate({
        where: { ...monthFilter, type: SaleType.CREDIT },
        _sum: { total: true },
      }),

      prisma.sale.groupBy({
        by: ['status'],
        where: monthFilter,
        _count: { _all: true },
        _sum: { total: true },
      }),

      prisma.sale.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { items: true },
      }),

      prisma.sale.findMany({
        where: {
          type: SaleType.CREDIT,
          status: { in: [SaleStatus.PENDING, SaleStatus.PARTIAL] },
          collectionDay: { not: null },
          installmentsCount: { not: null },
        },
        select: {
          id: true,
          saleNumber: true,
          clientId: true,
          total: true,
          createdAt: true,
          installmentsCount: true,
          installmentAmount: true,
          collectionDay: true,
          collectionDay2: true,
          frequency: true,
          initialPayment: true,
          client: { select: { name: true } },
        },
      }),
    ]);

    const activeSaleIds = activeCreditSales.map((s) => s.id);

    // Bulk-load all payments for active credit sales in a single query (avoids N+1).
    const paymentsRaw =
      activeSaleIds.length > 0
        ? await prisma.payment.findMany({
            where: { saleId: { in: activeSaleIds } },
            select: { saleId: true, amount: true },
          })
        : [];

    const paymentsBySaleId: Record<string, { amount: number }[]> = {};
    for (const p of paymentsRaw) {
      if (!p.saleId) continue;
      if (!paymentsBySaleId[p.saleId]) paymentsBySaleId[p.saleId] = [];
      paymentsBySaleId[p.saleId].push({ amount: Number(p.amount) });
    }

    return {
      totalSalesAmountThisMonth: Number(salesAgg._sum.total ?? 0),
      salesCountThisMonth: salesAgg._count._all,
      totalCollectedThisMonth: Number(paymentsAgg._sum.amount ?? 0),
      totalPendingDebt: Number(clientsAgg._sum.balance ?? 0),
      activeClientsCount: clientsAgg._count._all,
      totalCashSalesThisMonth: Number(cashSalesAgg._sum.total ?? 0),
      totalCreditSalesThisMonth: Number(creditSalesAgg._sum.total ?? 0),
      salesByStatus: salesGroupBy.map((g) => ({
        status: g.status,
        count: g._count._all,
        amount: Number(g._sum.total ?? 0),
      })),
      recentSales: recentSales.map((s) => s as unknown as Record<string, unknown>),
      activeCreditSales: activeCreditSales.map((s) => ({
        id: s.id,
        saleNumber: s.saleNumber,
        clientId: s.clientId,
        clientName: s.client.name,
        total: Number(s.total),
        createdAt: s.createdAt,
        installmentsCount: s.installmentsCount!,
        installmentAmount: s.installmentAmount != null ? Number(s.installmentAmount) : null,
        collectionDay: s.collectionDay!,
        collectionDay2: s.collectionDay2 ?? null,
        frequency: s.frequency ?? null,
        initialPayment: s.initialPayment != null ? Number(s.initialPayment) : null,
      })) as DashboardActiveCreditSale[],
      paymentsBySaleId,
    };
  }
}
