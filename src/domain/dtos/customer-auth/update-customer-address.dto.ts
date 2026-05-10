import type { CustomerAddressUpdateData } from '../../datasources/customer-address.datasource';

const MAX_LABEL = 80;
const MAX_LINE1 = 300;
const MAX_LINE2 = 200;
const MAX_CITY_DEPT = 120;
const MAX_POSTAL = 16;
const MAX_PHONE = 30;

function hasOwn(o: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(o, key);
}

export class UpdateCustomerAddressDto {
  private constructor(public readonly patch: CustomerAddressUpdateData) {}

  static create(object: Record<string, unknown>): [string?, UpdateCustomerAddressDto?] {
    const patch: CustomerAddressUpdateData = {};

    if (hasOwn(object, 'label')) {
      const label = object.label;
      if (label === null) {
        patch.label = null;
      } else if (typeof label !== 'string') {
        return ['label debe ser texto o null'];
      } else if (label.trim().length > MAX_LABEL) {
        return [`label no puede exceder ${MAX_LABEL} caracteres`];
      } else {
        patch.label = label.trim().length > 0 ? label.trim() : null;
      }
    }

    if (hasOwn(object, 'line1')) {
      const line1 = object.line1;
      if (line1 === null || typeof line1 !== 'string') {
        return ['line1 debe ser texto'];
      }
      if (line1.trim().length < 3) {
        return ['line1 debe tener al menos 3 caracteres'];
      }
      if (line1.trim().length > MAX_LINE1) {
        return [`line1 no puede exceder ${MAX_LINE1} caracteres`];
      }
      patch.line1 = line1.trim();
    }

    if (hasOwn(object, 'line2')) {
      const line2 = object.line2;
      if (line2 === null) {
        patch.line2 = null;
      } else if (typeof line2 !== 'string') {
        return ['line2 debe ser texto o null'];
      } else if (line2.trim().length > MAX_LINE2) {
        return [`line2 no puede exceder ${MAX_LINE2} caracteres`];
      } else {
        patch.line2 = line2.trim().length > 0 ? line2.trim() : null;
      }
    }

    if (hasOwn(object, 'city')) {
      const city = object.city;
      if (city === null || typeof city !== 'string') {
        return ['city debe ser texto'];
      }
      if (city.trim().length < 2) {
        return ['city debe tener al menos 2 caracteres'];
      }
      if (city.trim().length > MAX_CITY_DEPT) {
        return [`city no puede exceder ${MAX_CITY_DEPT} caracteres`];
      }
      patch.city = city.trim();
    }

    if (hasOwn(object, 'department')) {
      const department = object.department;
      if (department === null || typeof department !== 'string') {
        return ['department debe ser texto'];
      }
      if (department.trim().length < 2) {
        return ['department debe tener al menos 2 caracteres'];
      }
      if (department.trim().length > MAX_CITY_DEPT) {
        return [`department no puede exceder ${MAX_CITY_DEPT} caracteres`];
      }
      patch.department = department.trim();
    }

    if (hasOwn(object, 'postalCode')) {
      const postalCode = object.postalCode;
      if (postalCode === null) {
        patch.postalCode = null;
      } else if (typeof postalCode !== 'string') {
        return ['postalCode debe ser texto o null'];
      } else if (postalCode.trim().length > MAX_POSTAL) {
        return [`postalCode no puede exceder ${MAX_POSTAL} caracteres`];
      } else {
        patch.postalCode = postalCode.trim().length > 0 ? postalCode.trim() : null;
      }
    }

    if (hasOwn(object, 'phone')) {
      const phone = object.phone;
      if (phone === null) {
        patch.phone = null;
      } else if (typeof phone !== 'string') {
        return ['phone debe ser texto o null'];
      } else if (phone.trim().length > 0 && phone.trim().length < 7) {
        return ['phone debe tener al menos 7 caracteres si se envía'];
      } else if (phone.trim().length > MAX_PHONE) {
        return [`phone no puede exceder ${MAX_PHONE} caracteres`];
      } else {
        patch.phone = phone.trim().length > 0 ? phone.trim() : null;
      }
    }

    if (hasOwn(object, 'countryCode')) {
      const countryCode = object.countryCode;
      if (countryCode === null || typeof countryCode !== 'string') {
        return ['countryCode debe ser texto'];
      }
      patch.countryCode = countryCode.trim().toUpperCase();
    }

    if (hasOwn(object, 'isDefault')) {
      const isDefault = object.isDefault;
      if (typeof isDefault === 'boolean') {
        patch.isDefault = isDefault;
      } else if (isDefault === 'true') {
        patch.isDefault = true;
      } else if (isDefault === 'false') {
        patch.isDefault = false;
      } else {
        return ['isDefault debe ser booleano'];
      }
    }

    const keys = Object.keys(patch);
    if (keys.length === 0) {
      return ['Se requiere al menos un campo para actualizar la dirección'];
    }

    return [undefined, new UpdateCustomerAddressDto(patch)];
  }
}
