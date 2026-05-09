import { regularExps } from '../../../config/regular-exp';
import { OrderPaymentMethod } from '../../entities/online-order.entity';

export type OrderItemInput = {
  productId: string;
  quantity: number;
};

export class CreateOnlineOrderDto {
  private constructor(
    public readonly items: OrderItemInput[],
    public readonly paymentMethod: OrderPaymentMethod,
    public readonly shippingAddress: string,
    // Guest fields (null when authenticated customer)
    public readonly guestName: string | null,
    public readonly guestPhone: string | null,
    public readonly guestEmail: string | null,
    /** Optional client-side fingerprint (e.g. FingerprintJS hash) for antifraud history */
    public readonly deviceFingerprintHash: string | null,
  ) {}

  static create(object: Record<string, unknown>): [string?, CreateOnlineOrderDto?] {
    const { items, paymentMethod, shippingAddress, guestName, guestPhone, guestEmail, deviceFingerprintHash } =
      object;

    // items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return ['items debe ser un arreglo no vacío'];
    }

    const parsedItems: OrderItemInput[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i] as Record<string, unknown>;
      if (!item || typeof item !== 'object') return [`items[${i}] debe ser un objeto`];

      const { productId, quantity } = item;
      if (!productId || typeof productId !== 'string' || productId.trim().length === 0) {
        return [`items[${i}].productId es requerido`];
      }
      if (quantity === undefined || quantity === null) return [`items[${i}].quantity es requerido`];
      const qty = Number(quantity);
      if (!Number.isInteger(qty) || qty < 1) return [`items[${i}].quantity debe ser un entero mayor a 0`];

      parsedItems.push({ productId: (productId as string).trim(), quantity: qty });
    }

    // Check duplicate productIds
    const ids = parsedItems.map((i) => i.productId);
    if (new Set(ids).size !== ids.length) return ['No se puede ordenar el mismo producto dos veces'];

    // paymentMethod
    const validMethods = Object.values(OrderPaymentMethod) as string[];
    if (!paymentMethod || !validMethods.includes(paymentMethod as string)) {
      return [`paymentMethod debe ser uno de: ${validMethods.join(', ')}`];
    }

    // shippingAddress
    if (!shippingAddress || typeof shippingAddress !== 'string' || (shippingAddress as string).trim().length === 0) {
      return ['shippingAddress es requerido'];
    }

    // Guest fields: if none are provided → authenticated mode (validated at use-case level with customerId)
    // If any guest field is provided → validate all required ones
    const hasGuest = guestName !== undefined || guestPhone !== undefined || guestEmail !== undefined;

    let parsedGuestName: string | null = null;
    let parsedGuestPhone: string | null = null;
    let parsedGuestEmail: string | null = null;

    if (hasGuest) {
      if (!guestName || typeof guestName !== 'string' || (guestName as string).trim().length < 2) {
        return ['guestName debe tener al menos 2 caracteres'];
      }
      if (!guestEmail || typeof guestEmail !== 'string') {
        return ['guestEmail es requerido para órdenes de invitado'];
      }
      const normalizedEmail = (guestEmail as string).trim().toLowerCase();
      if (!regularExps.email.test(normalizedEmail)) {
        return ['guestEmail no tiene un formato válido'];
      }
      parsedGuestName = (guestName as string).trim();
      parsedGuestPhone = guestPhone ? (guestPhone as string).trim() : null;
      parsedGuestEmail = normalizedEmail;
    }

    let parsedFingerprint: string | null = null;
    if (deviceFingerprintHash !== undefined && deviceFingerprintHash !== null) {
      if (typeof deviceFingerprintHash !== 'string') {
        return ['deviceFingerprintHash debe ser texto'];
      }
      const fp = deviceFingerprintHash.trim();
      if (fp.length > 128) {
        return ['deviceFingerprintHash no puede exceder 128 caracteres'];
      }
      parsedFingerprint = fp.length > 0 ? fp : null;
    }

    return [
      undefined,
      new CreateOnlineOrderDto(
        parsedItems,
        paymentMethod as OrderPaymentMethod,
        (shippingAddress as string).trim(),
        parsedGuestName,
        parsedGuestPhone,
        parsedGuestEmail,
        parsedFingerprint,
      ),
    ];
  }
}
