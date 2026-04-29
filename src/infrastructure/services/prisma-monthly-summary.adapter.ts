import { MonthlySummaryPort, MonthlySummaryResult } from '../../domain/services';
import { prisma } from '../../config/prisma';

export class PrismaMonthlySummaryAdapter implements MonthlySummaryPort {
  async getSummary(year: number, month: number): Promise<MonthlySummaryResult> {
    const dateFrom = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const dateTo = new Date(year, month, 0, 23, 59, 59, 999);

    const [cashSales, creditPayments, ecommerceOrders] = await Promise.all([
      prisma.sale.aggregate({
        _sum: { total: true },
        _count: true,
        where: {
          type: 'CASH',
          createdAt: { gte: dateFrom, lte: dateTo },
        },
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        _count: true,
        where: {
          createdAt: { gte: dateFrom, lte: dateTo },
        },
      }),
      prisma.onlineOrder.aggregate({
        _sum: { totalAmount: true },
        _count: true,
        where: {
          status: 'PAID',
          createdAt: { gte: dateFrom, lte: dateTo },
        },
      }),
    ]);

    const cashSalesTotal = Number(cashSales._sum.total ?? 0);
    const creditPaymentsTotal = Number(creditPayments._sum.amount ?? 0);
    const ecommerceTotal = Number(ecommerceOrders._sum.totalAmount ?? 0);
    const grandTotal = cashSalesTotal + creditPaymentsTotal + ecommerceTotal;

    return {
      cashSalesCount: cashSales._count,
      cashSalesTotal,
      creditPaymentsCount: creditPayments._count,
      creditPaymentsTotal,
      ecommerceCount: ecommerceOrders._count,
      ecommerceTotal,
      grandTotal,
    };
  }
}
