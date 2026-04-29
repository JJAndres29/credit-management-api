export type MonthlySummaryResult = {
  cashSalesCount: number;
  cashSalesTotal: number;
  creditPaymentsCount: number;
  creditPaymentsTotal: number;
  ecommerceCount: number;
  ecommerceTotal: number;
  grandTotal: number;
};

export interface MonthlySummaryPort {
  getSummary(year: number, month: number): Promise<MonthlySummaryResult>;
}
