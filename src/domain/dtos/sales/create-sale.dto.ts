import { SaleType, InstallmentFrequency } from '../../entities';

export interface CreateSaleItemDto {
  productId: string;
  quantity: number;
  /** Precio unitario del producto fijado al momento de la venta. Debe ser mayor a 0. */
  unitPrice: number;
}

export class CreateSaleDto {
  private constructor(
    public readonly clientId: string,
    public readonly type: SaleType,
    public readonly items: CreateSaleItemDto[],
    /** Número de cuotas para ventas a crédito. Mínimo 2. */
    public readonly installmentsCount: number | undefined,
    /** Periodicidad de pago: MONTHLY o BIWEEKLY. */
    public readonly frequency: InstallmentFrequency | undefined,
    /** Día del mes para el cobro (1-31). */
    public readonly collectionDay: number | undefined,
    /** Segundo día de cobro (1-31). Solo para planes BIWEEKLY. */
    public readonly collectionDay2: number | undefined,
    /**
     * Pago inicial opcional al momento de crear la venta a crédito.
     * Reduce el saldo pendiente y el monto de cada cuota se recalcula
     * sobre (total - initialPayment).
     */
    public readonly initialPayment: number | undefined,
  ) {}

  static create(object: Record<string, unknown>): [string?, CreateSaleDto?] {
    const {
      clientId, type, items,
      installmentsCount, frequency,
      collectionDay, collectionDay2, initialPayment,
    } = object;

    if (!clientId || typeof clientId !== 'string' || clientId.trim().length === 0) {
      return ['El ID del cliente es requerido'];
    }

    const validTypes = Object.values(SaleType);
    if (!type || !validTypes.includes(type as SaleType)) {
      return [`El tipo de venta debe ser: ${validTypes.join(' | ')}`];
    }

    if (!Array.isArray(items) || items.length === 0) {
      return ['La venta debe tener al menos un producto'];
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i] as Record<string, unknown>;

      if (!item.productId || typeof item.productId !== 'string' || (item.productId as string).trim().length === 0) {
        return [`El producto en la posición ${i + 1} no tiene un ID válido`];
      }

      const qty = item.quantity;
      if (qty === undefined || typeof qty !== 'number' || !Number.isInteger(qty) || qty < 1) {
        return [`La cantidad en la posición ${i + 1} debe ser un número entero mayor a 0`];
      }

      const price = item.unitPrice;
      if (price === undefined || price === null || typeof price !== 'number' || price <= 0) {
        return [`El precio unitario en la posición ${i + 1} debe ser un número mayor a 0`];
      }
    }

    // Detectar productos duplicados en la misma venta
    const productIds = (items as Record<string, unknown>[]).map((i) => i.productId as string);
    if (new Set(productIds).size !== productIds.length) {
      return ['No se pueden repetir productos en una misma venta'];
    }

    // --- Validación de campos de cuotas ---
    const hasInstallmentsCount = installmentsCount !== undefined && installmentsCount !== null;
    const hasFrequency = frequency !== undefined && frequency !== null;

    if ((hasInstallmentsCount || hasFrequency) && type !== SaleType.CREDIT) {
      return ['Los campos de cuotas (installmentsCount, frequency) solo aplican a ventas de tipo CREDIT'];
    }

    if (hasInstallmentsCount !== hasFrequency) {
      return ['Debes proporcionar tanto installmentsCount como frequency para definir un plan de cuotas'];
    }

    let parsedInstallmentsCount: number | undefined;
    let parsedFrequency: InstallmentFrequency | undefined;

    if (hasInstallmentsCount) {
      if (typeof installmentsCount !== 'number' || !Number.isInteger(installmentsCount) || installmentsCount < 2) {
        return ['installmentsCount debe ser un número entero mayor o igual a 2'];
      }

      const validFrequencies = Object.values(InstallmentFrequency);
      if (!validFrequencies.includes(frequency as InstallmentFrequency)) {
        return [`frequency debe ser: ${validFrequencies.join(' | ')}`];
      }

      parsedInstallmentsCount = installmentsCount as number;
      parsedFrequency = frequency as InstallmentFrequency;
    }

    // --- Validación de días de cobro ---
    const hasCollectionDay = collectionDay !== undefined && collectionDay !== null;
    const hasCollectionDay2 = collectionDay2 !== undefined && collectionDay2 !== null;

    if ((hasCollectionDay || hasCollectionDay2) && !hasInstallmentsCount) {
      return ['Los días de cobro (collectionDay, collectionDay2) solo se pueden definir junto con un plan de cuotas'];
    }

    let parsedCollectionDay: number | undefined;
    let parsedCollectionDay2: number | undefined;

    if (hasCollectionDay) {
      const day = Number(collectionDay);
      if (!Number.isInteger(day) || day < 1 || day > 31) {
        return ['collectionDay debe ser un número entero entre 1 y 31'];
      }
      parsedCollectionDay = day;
    }

    if (hasCollectionDay2) {
      if (parsedFrequency !== InstallmentFrequency.BIWEEKLY) {
        return ['collectionDay2 solo aplica a planes con frequency BIWEEKLY'];
      }
      const day2 = Number(collectionDay2);
      if (!Number.isInteger(day2) || day2 < 1 || day2 > 31) {
        return ['collectionDay2 debe ser un número entero entre 1 y 31'];
      }
      parsedCollectionDay2 = day2;
    }

    if (parsedFrequency === InstallmentFrequency.BIWEEKLY && hasCollectionDay && !hasCollectionDay2) {
      return ['Para planes BIWEEKLY debes proporcionar tanto collectionDay como collectionDay2'];
    }

    if (parsedFrequency === InstallmentFrequency.MONTHLY && hasCollectionDay2) {
      return ['collectionDay2 no aplica a planes MONTHLY; usa solo collectionDay'];
    }

    // --- Validación de cuota inicial ---
    let parsedInitialPayment: number | undefined;
    if (initialPayment !== undefined && initialPayment !== null && initialPayment !== 0) {
      if (type !== SaleType.CREDIT) {
        return ['La cuota inicial solo aplica a ventas de tipo CREDIT'];
      }
      if (typeof initialPayment !== 'number' || isNaN(initialPayment) || initialPayment < 0) {
        return ['La cuota inicial debe ser un número mayor o igual a 0'];
      }
      const rounded = Math.round(initialPayment * 100) / 100;
      if (rounded !== initialPayment && Math.abs(rounded - initialPayment) > 0.001) {
        return ['La cuota inicial no puede tener más de 2 decimales'];
      }
      parsedInitialPayment = rounded;
    }

    return [
      undefined,
      new CreateSaleDto(
        clientId.trim(),
        type as SaleType,
        (items as Record<string, unknown>[]).map((i) => ({
          productId: (i.productId as string).trim(),
          quantity: i.quantity as number,
          unitPrice: i.unitPrice as number,
        })),
        parsedInstallmentsCount,
        parsedFrequency,
        parsedCollectionDay,
        parsedCollectionDay2,
        parsedInitialPayment,
      ),
    ];
  }
}
