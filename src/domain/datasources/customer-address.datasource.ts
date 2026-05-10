export type CustomerAddressRow = {
  id: string;
  customerId: string;
  label: string | null;
  line1: string;
  line2: string | null;
  city: string;
  department: string;
  countryCode: string;
  postalCode: string | null;
  phone: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type CustomerAddressCreateData = {
  label?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  department: string;
  countryCode?: string;
  postalCode?: string | null;
  phone?: string | null;
  isDefault?: boolean;
};

export interface CustomerAddressDatasource {
  findAllByCustomer(customerId: string): Promise<CustomerAddressRow[]>;
  create(customerId: string, data: CustomerAddressCreateData): Promise<CustomerAddressRow>;
  setDefault(customerId: string, addressId: string): Promise<void>;
}
