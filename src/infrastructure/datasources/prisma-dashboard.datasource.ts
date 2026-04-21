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

    const [salesAgg, paymentsAgg, clientsAgg, salesGroupBy, recentSales, activeCreditSales] =
      await Promise.all([
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
            client: { select: { name: true } },
          },
        }),
      ]);

    return {
      totalSalesAmountThisMonth: Number(salesAgg._sum.total ?? 0),
      salesCountThisMonth: salesAgg._count._all,
      totalCollectedThisMonth: Number(paymentsAgg._sum.amount ?? 0),
      totalPendingDebt: Number(clientsAgg._sum.balance ?? 0),
      activeClientsCount: clientsAgg._count._all,
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
      })) as DashboardActiveCreditSale[],
    };
  }
}
