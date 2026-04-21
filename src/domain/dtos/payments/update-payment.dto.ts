export class UpdatePaymentDto {
  private constructor(
    public readonly amount: number | undefined,
    public readonly note: string | null | undefined,
    /** Fecha real en que se realizó el pago. Permite corregir errores de digitación. */
    public readonly createdAt: Date | undefined,
  ) {}

  static create(object: Record<string, unknown>): [string?, UpdatePaymentDto?] {
    const { amount, note, createdAt } = object;

    if (amount === undefined && note === undefined && createdAt === undefined) {
      return ['Se requiere al menos un campo para actualizar: amount, note o createdAt'];
    }

    let parsedAmount: number | undefined;

    if (amount !== undefined) {
      if (amount === null) {
        return ['El monto no puede ser nulo'];
      }
      parsedAmount = Number(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return ['El monto debe ser un número mayor a 0'];
      }
      if (!/^\d+(\.\d{1,2})?$/.test(String(parsedAmount))) {
        return ['El monto no puede tener más de 2 decimales'];
      }
    }

    let parsedNote: string | null | undefined;

    if (note !== undefined) {
      if (note === null) {
        parsedNote = null;
      } else if (typeof note !== 'string') {
        return ['La nota debe ser una cadena de texto'];
      } else if (note.trim().length > 500) {
        return ['La nota no puede superar los 500 caracteres'];
      } else {
        parsedNote = note.trim() || null;
      }
    }

    let parsedCreatedAt: Date | undefined;
    if (createdAt !== undefined && createdAt !== null) {
      if (typeof createdAt !== 'string' || (createdAt as string).trim().length === 0) {
        return ['La fecha (createdAt) debe ser una cadena de texto en formato ISO 8601'];
      }
      const d = new Date(createdAt as string);
      if (isNaN(d.getTime())) {
        return ['La fecha (createdAt) no es válida. Use formato ISO 8601 (ej. 2026-04-20T23:30:00-05:00)'];
      }
      parsedCreatedAt = d;
    }

    return [undefined, new UpdatePaymentDto(parsedAmount, parsedNote, parsedCreatedAt)];
  }
}
