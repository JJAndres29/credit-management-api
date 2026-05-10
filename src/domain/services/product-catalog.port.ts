export type ProductForOrder = {
  id: string;
  name: string;
  retailPrice: number | null;
  stock: number;
  isActive: boolean;
  /** P2: default SKU row for dual-write inventory */
  defaultVariantId: string | null;
  /** For scoped coupons (P3) */
  categoryId: string | null;
  /** kg por unidad para cotización envío; null si el catálogo aún no lo tiene */
  weightKg: number | null;
  /** IVA % stored on product, if any */
  productIvaRate: number | null;
  /** IVA % from category, if any */
  categoryIvaRate: number | null;
};

export type StockIncrementOptions = {
  /** When releasing ecommerce reservation — audit trail */
  orderId?: string;
  movementNote?: string;
};

export interface ProductCatalogPort {
  getForOrder(productId: string): Promise<ProductForOrder | null>;
  // Returns false if stock was insufficient (atomic check-and-decrement)
  decrementStockAtomic(productId: string, qty: number): Promise<boolean>;
  incrementStock(productId: string, qty: number, opts?: StockIncrementOptions): Promise<void>;
}
