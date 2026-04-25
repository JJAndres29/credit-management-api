import { CustomerEntity } from '../entities';
import { CustomerCreateData, CustomerUpdateData, FilterCustomersData } from '../datasources';
import { PaginationDto } from '../dtos/shared';
import { PaginatedResult } from '../types/paginated.type';

export interface CustomerRepository {
  findAll(pagination: PaginationDto, filters: FilterCustomersData): Promise<PaginatedResult<CustomerEntity>>;
  findByEmail(email: string): Promise<CustomerEntity | null>;
  findById(id: string): Promise<CustomerEntity | null>;
  findByGoogleId(googleId: string): Promise<CustomerEntity | null>;
  findByClientId(clientId: string): Promise<CustomerEntity | null>;
  create(data: CustomerCreateData): Promise<CustomerEntity>;
  update(id: string, data: CustomerUpdateData): Promise<CustomerEntity>;
  linkToClient(customerId: string, clientId: string): Promise<CustomerEntity>;
}
