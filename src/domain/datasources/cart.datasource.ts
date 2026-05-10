export type CartLineData = {
  id: string;
  productId: string;
  variantId: string;
  quantity: number;
  priceAtAdd: number;
  productNameSnapshot: string;
};

export type CartData = {
  id: string;
  sessionToken: string | null;
  customerId: string | null;
  items: CartLineData[];
};

export type CartLineUpsert = {
  productId: string;
  variantId: string;
  quantity: number;
  priceAtAdd: number;
  productNameSnapshot: string;
};

export interface CartDatasource {
  findByCustomerId(customerId: string): Promise<CartData | null>;
  findBySessionToken(sessionToken: string): Promise<CartData | null>;
  createForCustomer(customerId: string): Promise<CartData>;
  createWithSession(sessionToken: string): Promise<CartData>;
  upsertLineQuantity(cartId: string, line: CartLineUpsert): Promise<void>;
  setLineQuantity(cartId: string, itemId: string, quantity: number): Promise<void>;
  removeLine(cartId: string, itemId: string): Promise<void>;
  mergeSessionIntoCustomer(sessionToken: string, customerId: string): Promise<void>;
  deleteByCustomerId(customerId: string): Promise<void>;
  deleteBySessionToken(sessionToken: string): Promise<void>;
}
