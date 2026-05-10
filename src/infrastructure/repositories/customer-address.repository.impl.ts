import { CustomerAddressRepository } from '../../domain/repositories/customer-address.repository';
import {
  CustomerAddressDatasource,
  CustomerAddressRow,
  CustomerAddressCreateData,
} from '../../domain/datasources/customer-address.datasource';

export class CustomerAddressRepositoryImpl implements CustomerAddressRepository {
  constructor(private readonly datasource: CustomerAddressDatasource) {}

  findAllByCustomer(customerId: string): Promise<CustomerAddressRow[]> {
    return this.datasource.findAllByCustomer(customerId);
  }

  create(customerId: string, data: CustomerAddressCreateData): Promise<CustomerAddressRow> {
    return this.datasource.create(customerId, data);
  }

  setDefault(customerId: string, addressId: string): Promise<void> {
    return this.datasource.setDefault(customerId, addressId);
  }
}
