import {
  CustomerDatasource,
  CustomerCreateData,
  CustomerUpdateData,
  FilterCustomersData,
} from '../../domain/datasources';
import { CustomerRepository } from '../../domain/repositories';
import { CustomerEntity } from '../../domain/entities';
import { PaginationDto } from '../../domain/dtos/shared';
import { PaginatedResult } from '../../domain/types/paginated.type';

export class CustomerRepositoryImpl implements CustomerRepository {
  constructor(private readonly datasource: CustomerDatasource) {}

  findAll(pagination: PaginationDto, filters: FilterCustomersData): Promise<PaginatedResult<CustomerEntity>> {
    return this.datasource.findAll(pagination, filters);
  }

  findByEmail(email: string): Promise<CustomerEntity | null> {
    return this.datasource.findByEmail(email);
  }

  findById(id: string): Promise<CustomerEntity | null> {
    return this.datasource.findById(id);
  }

  findByGoogleId(googleId: string): Promise<CustomerEntity | null> {
    return this.datasource.findByGoogleId(googleId);
  }

  findByClientId(clientId: string): Promise<CustomerEntity | null> {
    return this.datasource.findByClientId(clientId);
  }

  create(data: CustomerCreateData): Promise<CustomerEntity> {
    return this.datasource.create(data);
  }

  update(id: string, data: CustomerUpdateData): Promise<CustomerEntity> {
    return this.datasource.update(id, data);
  }

  linkToClient(customerId: string, clientId: string): Promise<CustomerEntity> {
    return this.datasource.linkToClient(customerId, clientId);
  }
}
