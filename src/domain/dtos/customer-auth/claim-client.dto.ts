type DocumentType = 'CC' | 'CE';

export class ClaimClientDto {
  private constructor(
    public readonly documentType: DocumentType,
    public readonly documentNumber: string,
  ) {}

  static create(object: Record<string, unknown>): [string?, ClaimClientDto?] {
    const { documentType, documentNumber } = object;

    if (!documentType) return ['documentType es requerido'];
    if (documentType !== 'CC' && documentType !== 'CE') return ['documentType debe ser CC o CE'];
    if (!documentNumber) return ['documentNumber es requerido'];
    if (typeof documentNumber !== 'string' || documentNumber.trim().length === 0) {
      return ['documentNumber no puede estar vacío'];
    }

    return [undefined, new ClaimClientDto(documentType as DocumentType, (documentNumber as string).trim())];
  }
}
