import type {
  CustomerAddressRow,
  CustomerAddressCreateData,
  CustomerAddressUpdateData,
} from '../datasources/customer-address.datasource';

export interface CustomerAddressRepository {
  findAllByCustomer(customerId: string): Promise<CustomerAddressRow[]>;
  create(customerId: string, data: CustomerAddressCreateData): Promise<CustomerAddressRow>;
  update(customerId: string, addressId: string, data: CustomerAddressUpdateData): Promise<CustomerAddressRow>;
  delete(customerId: string, addressId: string): Promise<void>;
  setDefault(customerId: string, addressId: string): Promise<void>;
}
