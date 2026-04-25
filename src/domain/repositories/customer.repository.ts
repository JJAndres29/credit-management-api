import { CustomerEntity } from '../entities';
import { CustomerCreateData } from '../datasources';

export interface CustomerRepository {
  findByEmail(email: string): Promise<CustomerEntity | null>;
  findById(id: string): Promise<CustomerEntity | null>;
  create(data: CustomerCreateData): Promise<CustomerEntity>;
}
