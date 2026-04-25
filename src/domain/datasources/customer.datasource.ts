import { CustomerEntity } from '../entities';

export interface CustomerCreateData {
  name: string;
  email: string;
  password: string;
  phone: string;
}

export interface CustomerDatasource {
  findByEmail(email: string): Promise<CustomerEntity | null>;
  findById(id: string): Promise<CustomerEntity | null>;
  create(data: CustomerCreateData): Promise<CustomerEntity>;
}
