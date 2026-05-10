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

/** Solo campos presentes en el PATCH se aplican; `null` limpia opcionales (label, line2, postalCode, phone). */
export type CustomerAddressUpdateData = {
  label?: string | null;
  line1?: string;
  line2?: string | null;
  city?: string;
  department?: string;
  countryCode?: string;
  postalCode?: string | null;
  phone?: string | null;
  isDefault?: boolean;
};

export interface CustomerAddressDatasource {
  findAllByCustomer(customerId: string): Promise<CustomerAddressRow[]>;
  create(customerId: string, data: CustomerAddressCreateData): Promise<CustomerAddressRow>;
  update(customerId: string, addressId: string, data: CustomerAddressUpdateData): Promise<CustomerAddressRow>;
  delete(customerId: string, addressId: string): Promise<void>;
  setDefault(customerId: string, addressId: string): Promise<void>;
}
