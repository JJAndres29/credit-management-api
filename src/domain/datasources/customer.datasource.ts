import { CustomerEntity } from '../entities';
import { PaginationDto } from '../dtos/shared';
import { PaginatedResult } from '../types/paginated.type';

export interface CustomerCreateData {
  name: string;
  email: string;
  password?: string | null;
  phone: string;
  googleId?: string | null;
}

export interface CustomerUpdateData {
  name?: string;
  email?: string;
  phone?: string;
  password?: string | null;
  mustChangePassword?: boolean;
  isActive?: boolean;
}

export interface FilterCustomersData {
  search?: string;
  isActive?: boolean;
}

export interface CustomerDatasource {
  findAll(pagination: PaginationDto, filters: FilterCustomersData): Promise<PaginatedResult<CustomerEntity>>;
  findByEmail(email: string): Promise<CustomerEntity | null>;
  findById(id: string): Promise<CustomerEntity | null>;
  findByGoogleId(googleId: string): Promise<CustomerEntity | null>;
  findByClientId(clientId: string): Promise<CustomerEntity | null>;
  create(data: CustomerCreateData): Promise<CustomerEntity>;
  update(id: string, data: CustomerUpdateData): Promise<CustomerEntity>;
  linkToClient(customerId: string, clientId: string): Promise<CustomerEntity>;
}
