export class UpdateSaleDto {
  private constructor(
    /** Día del mes para el cobro (1-31). null para eliminar el valor existente. */
    public readonly collectionDay: number | null | undefined,
    /** Segundo día de cobro para planes BIWEEKLY (1-31). null para eliminar. */
    public readonly collectionDay2: number | null | undefined,
    /** Fecha real en que ocurrió la venta. Permite corregir errores de digitación. */
    public readonly createdAt: Date | undefined,
  ) {}

  static create(object: Record<string, unknown>): [string?, UpdateSaleDto?] {
    const { collectionDay, collectionDay2, createdAt } = object;

    if (collectionDay === undefined && collectionDay2 === undefined && createdAt === undefined) {
      return ['Se requiere al menos un campo para actualizar: collectionDay, collectionDay2 o createdAt'];
    }

    let parsedCollectionDay: number | null | undefined;
    if (collectionDay !== undefined) {
      if (collectionDay === null) {
        parsedCollectionDay = null;
      } else {
        const day = Number(collectionDay);
        if (!Number.isInteger(day) || day < 1 || day > 31) {
          return ['collectionDay debe ser un número entero entre 1 y 31'];
        }
        parsedCollectionDay = day;
      }
    }

    let parsedCollectionDay2: number | null | undefined;
    if (collectionDay2 !== undefined) {
      if (collectionDay2 === null) {
        parsedCollectionDay2 = null;
      } else {
        const day2 = Number(collectionDay2);
        if (!Number.isInteger(day2) || day2 < 1 || day2 > 31) {
          return ['collectionDay2 debe ser un número entero entre 1 y 31'];
        }
        parsedCollectionDay2 = day2;
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

    return [undefined, new UpdateSaleDto(parsedCollectionDay, parsedCollectionDay2, parsedCreatedAt)];
  }
}
