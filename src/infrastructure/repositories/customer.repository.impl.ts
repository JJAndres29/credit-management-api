import { CustomerDatasource, CustomerCreateData } from '../../domain/datasources';
import { CustomerRepository } from '../../domain/repositories';
import { CustomerEntity } from '../../domain/entities';

export class CustomerRepositoryImpl implements CustomerRepository {
  constructor(private readonly datasource: CustomerDatasource) {}

  findByEmail(email: string): Promise<CustomerEntity | null> {
    return this.datasource.findByEmail(email);
  }

  findById(id: string): Promise<CustomerEntity | null> {
    return this.datasource.findById(id);
  }

  create(data: CustomerCreateData): Promise<CustomerEntity> {
    return this.datasource.create(data);
  }
}
