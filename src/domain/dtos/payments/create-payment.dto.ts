export class CreatePaymentDto {
  private constructor(
    public readonly clientId: string,
    public readonly amount: number,
    public readonly saleId: string | null,
    public readonly note: string | null,
    /**
     * Fecha real en que se realizó el pago. Opcional — si no se provee
     * se usa la fecha/hora actual del servidor.
     * Útil para registrar pagos de días anteriores o corregir errores de digitación.
     */
    public readonly createdAt: Date | undefined,
  ) {}

  static create(object: Record<string, unknown>): [string?, CreatePaymentDto?] {
    const { clientId, amount, saleId, note, createdAt } = object;

    if (!clientId || typeof clientId !== 'string' || clientId.trim().length === 0) {
      return ['El ID del cliente es requerido'];
    }

    if (amount === undefined || amount === null) {
      return ['El monto del pago es requerido'];
    }

    const parsedAmount = Number(amount);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return ['El monto debe ser un número mayor a 0'];
    }

    // Limitar a 2 decimales para evitar problemas de precisión con Decimal de Prisma
    if (!/^\d+(\.\d{1,2})?$/.test(String(parsedAmount))) {
      return ['El monto no puede tener más de 2 decimales'];
    }

    if (saleId !== undefined && saleId !== null) {
      if (typeof saleId !== 'string' || saleId.trim().length === 0) {
        return ['El ID de la venta debe ser una cadena de texto válida'];
      }
    }

    if (note !== undefined && note !== null) {
      if (typeof note !== 'string') {
        return ['La nota debe ser una cadena de texto'];
      }
      if (note.trim().length > 500) {
        return ['La nota no puede superar los 500 caracteres'];
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

    return [
      undefined,
      new CreatePaymentDto(
        clientId.trim(),
        parsedAmount,
        saleId ? (saleId as string).trim() : null,
        note ? (note as string).trim() : null,
        parsedCreatedAt,
      ),
    ];
  }
}
