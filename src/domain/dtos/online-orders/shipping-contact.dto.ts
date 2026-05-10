export const SHIPPING_DOCUMENT_TYPES = ['CC', 'CE'] as const;
export type ShippingContactDocumentType = (typeof SHIPPING_DOCUMENT_TYPES)[number];

const MAX_NAME = 120;
const MAX_PHONE = 30;
const MAX_LINE1 = 280;
const MAX_LINE2 = 180;
const MAX_CITY_DEPT = 100;
const MAX_POSTAL = 14;
const MAX_DOC_NUM = 30;

export class ShippingContactDto {
  private constructor(
    public readonly recipientName: string,
    public readonly documentType: ShippingContactDocumentType,
    public readonly documentNumber: string,
    public readonly phone: string,
    public readonly addressLine1: string,
    public readonly addressLine2: string | null,
    public readonly city: string,
    public readonly department: string,
    public readonly postalCode: string,
  ) {}

  /** Una línea legible para PDF / logs (además de columnas estructuradas). */
  static formatSnapshotAddress(dto: ShippingContactDto): string {
    const extra = dto.addressLine2 ? `, ${dto.addressLine2}` : '';
    return `${dto.addressLine1}${extra} · ${dto.city}, ${dto.department} · CP ${dto.postalCode}`;
  }

  static create(object: unknown): [string?, ShippingContactDto?] {
    if (object === undefined || object === null) {
      return ['shippingContact es requerido para crear un pedido'];
    }
    if (typeof object !== 'object') {
      return ['shippingContact debe ser un objeto'];
    }
    const o = object as Record<string, unknown>;

    const recipientName = o.recipientName;
    if (!recipientName || typeof recipientName !== 'string' || recipientName.trim().length < 2) {
      return ['shippingContact.recipientName debe tener al menos 2 caracteres'];
    }
    if (recipientName.trim().length > MAX_NAME) {
      return [`shippingContact.recipientName no puede exceder ${MAX_NAME} caracteres`];
    }

    const documentTypeRaw = o.documentType;
    if (!documentTypeRaw || typeof documentTypeRaw !== 'string') {
      return ['shippingContact.documentType es requerido (CC o CE)'];
    }
    const documentType = documentTypeRaw.trim().toUpperCase();
    if (!SHIPPING_DOCUMENT_TYPES.includes(documentType as ShippingContactDocumentType)) {
      return ['shippingContact.documentType debe ser CC o CE'];
    }

    const documentNumber = o.documentNumber;
    if (!documentNumber || typeof documentNumber !== 'string' || documentNumber.trim().length < 5) {
      return ['shippingContact.documentNumber debe tener al menos 5 caracteres'];
    }
    if (documentNumber.trim().length > MAX_DOC_NUM) {
      return [`shippingContact.documentNumber no puede exceder ${MAX_DOC_NUM} caracteres`];
    }

    const phone = o.phone;
    if (!phone || typeof phone !== 'string' || phone.trim().length < 7) {
      return ['shippingContact.phone debe tener al menos 7 caracteres'];
    }
    if (phone.trim().length > MAX_PHONE) {
      return [`shippingContact.phone no puede exceder ${MAX_PHONE} caracteres`];
    }

    const addressLine1 = o.addressLine1;
    if (!addressLine1 || typeof addressLine1 !== 'string' || addressLine1.trim().length < 4) {
      return ['shippingContact.addressLine1 debe tener al menos 4 caracteres'];
    }
    if (addressLine1.trim().length > MAX_LINE1) {
      return [`shippingContact.addressLine1 no puede exceder ${MAX_LINE1} caracteres`];
    }

    let line2: string | null = null;
    if (o.addressLine2 !== undefined && o.addressLine2 !== null) {
      if (typeof o.addressLine2 !== 'string') return ['shippingContact.addressLine2 debe ser texto'];
      const t = o.addressLine2.trim();
      if (t.length > MAX_LINE2) return [`shippingContact.addressLine2 no puede exceder ${MAX_LINE2} caracteres`];
      line2 = t.length > 0 ? t : null;
    }

    const city = o.city;
    if (!city || typeof city !== 'string' || city.trim().length < 2) {
      return ['shippingContact.city es requerido'];
    }
    if (city.trim().length > MAX_CITY_DEPT) {
      return [`shippingContact.city no puede exceder ${MAX_CITY_DEPT} caracteres`];
    }

    const department = o.department;
    if (!department || typeof department !== 'string' || department.trim().length < 2) {
      return ['shippingContact.department es requerido'];
    }
    if (department.trim().length > MAX_CITY_DEPT) {
      return [`shippingContact.department no puede exceder ${MAX_CITY_DEPT} caracteres`];
    }

    const postalCode = o.postalCode;
    if (!postalCode || typeof postalCode !== 'string' || postalCode.trim().length < 4) {
      return ['shippingContact.postalCode es requerido (mínimo 4 caracteres)'];
    }
    if (postalCode.trim().length > MAX_POSTAL) {
      return [`shippingContact.postalCode no puede exceder ${MAX_POSTAL} caracteres`];
    }

    return [
      undefined,
      new ShippingContactDto(
        recipientName.trim(),
        documentType as ShippingContactDocumentType,
        documentNumber.trim(),
        phone.trim(),
        addressLine1.trim(),
        line2,
        city.trim(),
        department.trim(),
        postalCode.trim(),
      ),
    ];
  }
}
