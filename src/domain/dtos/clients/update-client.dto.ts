import { DocumentType } from '../../entities/client.entity';

const VALID_DOCUMENT_TYPES: DocumentType[] = ['CC', 'CE'];

export class UpdateClientDto {
  private constructor(
    public readonly name?: string,
    public readonly phone?: string,
    public readonly email?: string,
    public readonly documentType?: DocumentType,
    public readonly documentNumber?: string,
    public readonly address?: string,
    public readonly neighborhood?: string,
    public readonly creditLimit?: number,
  ) {}

  static create(object: Record<string, unknown>): [string?, UpdateClientDto?] {
    const { name, phone, email, documentType, documentNumber, address, neighborhood, creditLimit } = object;

    if (name !== undefined && (typeof name !== 'string' || name.trim().length < 2)) {
      return ['El nombre debe tener al menos 2 caracteres'];
    }
    if (phone !== undefined && typeof phone !== 'string') {
      return ['El teléfono no es válido'];
    }
    if (email !== undefined && (typeof email !== 'string' || !email.includes('@'))) {
      return ['El email no tiene un formato válido'];
    }
    if (documentType !== undefined && !VALID_DOCUMENT_TYPES.includes(documentType as DocumentType)) {
      return [`El tipo de documento debe ser uno de: ${VALID_DOCUMENT_TYPES.join(', ')}`];
    }
    if (documentNumber !== undefined && (typeof documentNumber !== 'string' || documentNumber.trim().length < 3)) {
      return ['El número de documento debe tener al menos 3 caracteres'];
    }
    if (address !== undefined && (typeof address !== 'string' || address.trim().length < 5)) {
      return ['La dirección debe tener al menos 5 caracteres'];
    }
    if (neighborhood !== undefined && (typeof neighborhood !== 'string' || neighborhood.trim().length < 2)) {
      return ['El barrio debe tener al menos 2 caracteres'];
    }
    if (creditLimit !== undefined && (typeof creditLimit !== 'number' || creditLimit < 0)) {
      return ['El límite de crédito debe ser un número mayor o igual a 0'];
    }

    const hasAtLeastOneField =
      name ?? phone ?? email ?? documentType ?? documentNumber ?? address ?? neighborhood ?? creditLimit;
    if (hasAtLeastOneField === undefined && creditLimit === undefined) {
      return ['Debe enviar al menos un campo para actualizar'];
    }

    return [
      undefined,
      new UpdateClientDto(
        name ? (name as string).trim() : undefined,
        phone ? (phone as string).trim() : undefined,
        email as string | undefined,
        documentType as DocumentType | undefined,
        documentNumber ? (documentNumber as string).trim() : undefined,
        address ? (address as string).trim() : undefined,
        neighborhood ? (neighborhood as string).trim() : undefined,
        creditLimit as number | undefined,
      ),
    ];
  }
}
