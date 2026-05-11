import { SaleType, InstallmentFrequency } from '../../entities';

export interface NewProductInline {
  /** Nombre del producto a crear. Mínimo 2 caracteres. */
  name: string;
  /** Stock inicial que se agrega al inventario. La cantidad vendida se descuenta de este valor. */
  stock: number;
}

export interface CreateSaleItemDto {
  /** ID de un producto existente en el inventario. Requerido si no se provee `newProduct`. */
  productId?: string;
  /** Producto nuevo a crear inline. Requerido si no se provee `productId`. */
  newProduct?: NewProductInline;
  /**
   * ID de la variante específica a vender. Opcional — si no se envía, el backend
   * resuelve a la variante default o única del producto. Cuando un producto tiene
   * múltiples variantes "reales", se recomienda enviar variantId explícitamente.
   */
  variantId?: string;
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
    /**
     * Fecha real en que ocurrió la venta. Opcional — si no se provee
     * se usa la fecha/hora actual del servidor (now()).
     * Útil para registrar ventas realizadas en fechas anteriores.
     */
    public readonly createdAt: Date | undefined,
  ) {}

  static create(object: Record<string, unknown>): [string?, CreateSaleDto?] {
    const {
      clientId, type, items,
      installmentsCount, frequency,
      collectionDay, collectionDay2, initialPayment,
      createdAt,
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
      const hasProductId = item.productId && typeof item.productId === 'string' && (item.productId as string).trim().length > 0;
      const hasNewProduct = item.newProduct && typeof item.newProduct === 'object';

      if (!hasProductId && !hasNewProduct) {
        return [`El ítem en la posición ${i + 1} debe tener productId (existente) o newProduct (nuevo)`];
      }

      if (hasProductId && hasNewProduct) {
        return [`El ítem en la posición ${i + 1} no puede tener productId y newProduct al mismo tiempo`];
      }

      if (hasNewProduct) {
        const np = item.newProduct as Record<string, unknown>;
        if (!np.name || typeof np.name !== 'string' || (np.name as string).trim().length < 2) {
          return [`El nombre del producto nuevo en la posición ${i + 1} debe tener al menos 2 caracteres`];
        }
        const npStock = np.stock;
        if (npStock === undefined || npStock === null || typeof npStock !== 'number' || !Number.isInteger(npStock) || (npStock as number) < 0) {
          return [`El stock del producto nuevo en la posición ${i + 1} debe ser un número entero mayor o igual a 0`];
        }
        const qty = item.quantity;
        if (qty === undefined || typeof qty !== 'number' || !Number.isInteger(qty) || qty < 1) {
          return [`La cantidad en la posición ${i + 1} debe ser un número entero mayor a 0`];
        }
        if ((npStock as number) < (qty as number)) {
          return [`El stock del producto nuevo en la posición ${i + 1} (${npStock}) debe ser mayor o igual a la cantidad a vender (${qty})`];
        }
      }

      if (hasProductId) {
        const qty = item.quantity;
        if (qty === undefined || typeof qty !== 'number' || !Number.isInteger(qty) || qty < 1) {
          return [`La cantidad en la posición ${i + 1} debe ser un número entero mayor a 0`];
        }
      }

      const price = item.unitPrice;
      if (price === undefined || price === null || typeof price !== 'number' || price <= 0) {
        return [`El precio unitario en la posición ${i + 1} debe ser un número mayor a 0`];
      }
    }

    // Detectar productIds duplicados entre productos existentes
    const productIds = (items as Record<string, unknown>[])
      .filter((i) => i.productId)
      .map((i) => (i.productId as string).trim());
    if (new Set(productIds).size !== productIds.length) {
      return ['No se pueden repetir productos en una misma venta'];
    }

    // Detectar nombres duplicados entre productos nuevos
    const newProductNames = (items as Record<string, unknown>[])
      .filter((i) => i.newProduct)
      .map((i) => ((i.newProduct as Record<string, unknown>).name as string).trim().toLowerCase());
    if (new Set(newProductNames).size !== newProductNames.length) {
      return ['No se pueden repetir nombres de productos nuevos en una misma venta'];
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
      if (typeof installmentsCount !== 'number' || !Number.isInteger(installmentsCount) || installmentsCount < 1) {
        return ['installmentsCount debe ser un número entero mayor o igual a 1'];
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
      if (parsedFrequency === InstallmentFrequency.WEEKLY) {
        // Para planes semanales, collectionDay es el día de la semana: 1=lunes … 7=domingo
        if (!Number.isInteger(day) || day < 1 || day > 7) {
          return ['Para planes WEEKLY, collectionDay debe ser un entero entre 1 (lunes) y 7 (domingo)'];
        }
      } else {
        // Para MONTHLY y BIWEEKLY, collectionDay es el día del mes: 1–31
        if (!Number.isInteger(day) || day < 1 || day > 31) {
          return ['collectionDay debe ser un número entero entre 1 y 31'];
        }
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

    if (
      (parsedFrequency === InstallmentFrequency.MONTHLY || parsedFrequency === InstallmentFrequency.WEEKLY) &&
      hasCollectionDay2
    ) {
      return ['collectionDay2 no aplica a planes MONTHLY ni WEEKLY; usa solo collectionDay'];
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

    // --- Validación de fecha de la venta ---
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
      new CreateSaleDto(
        clientId.trim(),
        type as SaleType,
        (items as Record<string, unknown>[]).map((i) => {
          const np = i.newProduct as Record<string, unknown> | undefined;
          return {
            productId: i.productId ? (i.productId as string).trim() : undefined,
            newProduct: np
              ? { name: (np.name as string).trim(), stock: np.stock as number }
              : undefined,
            variantId: i.variantId && typeof i.variantId === 'string'
              ? (i.variantId as string).trim()
              : undefined,
            quantity: i.quantity as number,
            unitPrice: i.unitPrice as number,
          };
        }),
        parsedInstallmentsCount,
        parsedFrequency,
        parsedCollectionDay,
        parsedCollectionDay2,
        parsedInitialPayment,
        parsedCreatedAt,
      ),
    ];
  }
}
