import { CartRepository } from '../../domain/repositories/cart.repository';
import {
  CartDatasource,
  CartData,
  CartLineUpsert,
} from '../../domain/datasources/cart.datasource';

export class CartRepositoryImpl implements CartRepository {
  constructor(private readonly datasource: CartDatasource) {}

  findByCustomerId(customerId: string): Promise<CartData | null> {
    return this.datasource.findByCustomerId(customerId);
  }

  findBySessionToken(sessionToken: string): Promise<CartData | null> {
    return this.datasource.findBySessionToken(sessionToken);
  }

  createForCustomer(customerId: string): Promise<CartData> {
    return this.datasource.createForCustomer(customerId);
  }

  createWithSession(sessionToken: string): Promise<CartData> {
    return this.datasource.createWithSession(sessionToken);
  }

  upsertLineQuantity(cartId: string, line: CartLineUpsert): Promise<void> {
    return this.datasource.upsertLineQuantity(cartId, line);
  }

  setLineQuantity(cartId: string, itemId: string, quantity: number): Promise<void> {
    return this.datasource.setLineQuantity(cartId, itemId, quantity);
  }

  removeLine(cartId: string, itemId: string): Promise<void> {
    return this.datasource.removeLine(cartId, itemId);
  }

  mergeSessionIntoCustomer(sessionToken: string, customerId: string): Promise<void> {
    return this.datasource.mergeSessionIntoCustomer(sessionToken, customerId);
  }

  deleteByCustomerId(customerId: string): Promise<void> {
    return this.datasource.deleteByCustomerId(customerId);
  }

  deleteBySessionToken(sessionToken: string): Promise<void> {
    return this.datasource.deleteBySessionToken(sessionToken);
  }
}
