import { SaleType } from '../../entities';

export interface CreateSaleItemDto {
  productId: string;
  quantity: number;
}

export class CreateSaleDto {
  private constructor(
    public readonly clientId: string,
    public readonly type: SaleType,
    public readonly items: CreateSaleItemDto[],
  ) {}

  static create(object: Record<string, unknown>): [string?, CreateSaleDto?] {
    const { clientId, type, items } = object;

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
    }

    // Detectar productos duplicados en la misma venta
    const productIds = (items as Record<string, unknown>[]).map((i) => i.productId as string);
    if (new Set(productIds).size !== productIds.length) {
      return ['No se pueden repetir productos en una misma venta'];
    }

    return [
      undefined,
      new CreateSaleDto(
        clientId.trim(),
        type as SaleType,
        (items as Record<string, unknown>[]).map((i) => ({
          productId: (i.productId as string).trim(),
          quantity: i.quantity as number,
        })),
      ),
    ];
  }
}
