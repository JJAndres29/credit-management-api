export class UpdatePaymentDto {
  private constructor(
    public readonly amount: number | undefined,
    public readonly note: string | null | undefined,
  ) {}

  static create(object: Record<string, unknown>): [string?, UpdatePaymentDto?] {
    const { amount, note } = object;

    if (amount === undefined && note === undefined) {
      return ['Se requiere al menos un campo para actualizar: amount o note'];
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

    return [undefined, new UpdatePaymentDto(parsedAmount, parsedNote)];
  }
}
