import { CustomerAddressRepository } from '../../domain/repositories/customer-address.repository';
import {
  CustomerAddressDatasource,
  CustomerAddressRow,
  CustomerAddressCreateData,
  CustomerAddressUpdateData,
} from '../../domain/datasources/customer-address.datasource';

export class CustomerAddressRepositoryImpl implements CustomerAddressRepository {
  constructor(private readonly datasource: CustomerAddressDatasource) {}

  findAllByCustomer(customerId: string): Promise<CustomerAddressRow[]> {
    return this.datasource.findAllByCustomer(customerId);
  }

  create(customerId: string, data: CustomerAddressCreateData): Promise<CustomerAddressRow> {
    return this.datasource.create(customerId, data);
  }

  update(customerId: string, addressId: string, data: CustomerAddressUpdateData): Promise<CustomerAddressRow> {
    return this.datasource.update(customerId, addressId, data);
  }

  delete(customerId: string, addressId: string): Promise<void> {
    return this.datasource.delete(customerId, addressId);
  }

  setDefault(customerId: string, addressId: string): Promise<void> {
    return this.datasource.setDefault(customerId, addressId);
  }
}
