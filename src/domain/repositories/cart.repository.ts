import {
  CartData,
  CartLineUpsert,
} from '../datasources/cart.datasource';

export interface CartRepository {
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
