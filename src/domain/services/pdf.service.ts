export interface SaleItemData {
  productName: string;
  quantity: number;
  basePrice: number | null;
  unitPrice: number;
  subtotal: number;
  appliedRule: string | null;
}

export interface SaleData {
  id: string;
  type: string;
  status: string;
  total: number;
  createdAt: Date;
  items: SaleItemData[];
}

export interface PaymentData {
  id: string;
  amount: number;
  note: string | null;
  createdAt: Date;
  saleId: string | null;
}

export interface AccountStatementData {
  client: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    creditLimit: number;
    balance: number;
  };
  sales: SaleData[];
  payments: PaymentData[];
  generatedAt: Date;
  generatedBy: string;
}

export interface PdfService {
  generateAccountStatement(data: AccountStatementData): Promise<Buffer>;
}
