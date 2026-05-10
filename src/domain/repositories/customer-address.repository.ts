import {
  CustomerAddressRow,
  CustomerAddressCreateData,
} from '../datasources/customer-address.datasource';

export interface CustomerAddressRepository {
  findAllByCustomer(customerId: string): Promise<CustomerAddressRow[]>;
  create(customerId: string, data: CustomerAddressCreateData): Promise<CustomerAddressRow>;
  setDefault(customerId: string, addressId: string): Promise<void>;
}
