export type ProductForOrder = {
  id: string;
  name: string;
  retailPrice: number | null;
  stock: number;
  isActive: boolean;
};

export interface ProductCatalogPort {
  getForOrder(productId: string): Promise<ProductForOrder | null>;
  // Returns false if stock was insufficient (atomic check-and-decrement)
  decrementStockAtomic(productId: string, qty: number): Promise<boolean>;
  incrementStock(productId: string, qty: number): Promise<void>;
}
