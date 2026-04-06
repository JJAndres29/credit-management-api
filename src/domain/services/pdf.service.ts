export interface PdfService {
  generateAccountStatement(data: AccountStatementData): Promise<string>;
}

export interface AccountStatementData {
  clientName: string;
  date: Date;
  creditLimit: number;
  balanceBefore: number;
  paymentAmount: number;
  balanceAfter: number;
  activeCreditSales: unknown[];
  recentPayments: unknown[];
}
