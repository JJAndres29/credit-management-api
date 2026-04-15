import { DocumentType } from '../../entities/client.entity';

const VALID_DOCUMENT_TYPES: DocumentType[] = ['CC', 'CE'];

export class CreateClientDto {
  private constructor(
    public readonly name: string,
    public readonly phone: string,
    public readonly documentType: DocumentType,
    public readonly documentNumber: string,
    public readonly address: string,
    public readonly neighborhood: string,
    public readonly creditLimit: number,
    public readonly email?: string,
  ) {}

  static create(object: Record<string, unknown>): [string?, CreateClientDto?] {
    const { name, phone, email, documentType, documentNumber, address, neighborhood, creditLimit } = object;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return ['El nombre es requerido y debe tener al menos 2 caracteres'];
    }
    if (!phone || typeof phone !== 'string') {
      return ['El teléfono es requerido'];
    }
    if (email !== undefined && (typeof email !== 'string' || !email.includes('@'))) {
      return ['El email no tiene un formato válido'];
    }
    if (!documentType || !VALID_DOCUMENT_TYPES.includes(documentType as DocumentType)) {
      return [`El tipo de documento es requerido y debe ser uno de: ${VALID_DOCUMENT_TYPES.join(', ')}`];
    }
    if (!documentNumber || typeof documentNumber !== 'string' || documentNumber.trim().length < 3) {
      return ['El número de documento es requerido y debe tener al menos 3 caracteres'];
    }
    if (!address || typeof address !== 'string' || address.trim().length < 5) {
      return ['La dirección es requerida y debe tener al menos 5 caracteres'];
    }
    if (!neighborhood || typeof neighborhood !== 'string' || neighborhood.trim().length < 2) {
      return ['El barrio es requerido y debe tener al menos 2 caracteres'];
    }
    if (creditLimit === undefined || creditLimit === null) {
      return ['El límite de crédito es requerido'];
    }
    if (typeof creditLimit !== 'number' || creditLimit < 0) {
      return ['El límite de crédito debe ser un número mayor o igual a 0'];
    }

    return [
      undefined,
      new CreateClientDto(
        name.trim(),
        phone.trim(),
        documentType as DocumentType,
        (documentNumber as string).trim(),
        (address as string).trim(),
        (neighborhood as string).trim(),
        creditLimit,
        email as string | undefined,
      ),
    ];
  }
}
