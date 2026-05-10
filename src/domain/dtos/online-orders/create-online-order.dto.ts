import { regularExps } from '../../../config/regular-exp';
import { OrderPaymentMethod } from '../../entities/online-order.entity';
import { ShippingContactDto } from './shipping-contact.dto';

const MAX_ITEMS = 50;
const MAX_QUANTITY = 999;
const MAX_SHIPPING_ADDRESS_LENGTH = 500;
const MAX_GUEST_NAME_LENGTH = 120;
const MAX_GUEST_PHONE_LENGTH = 30;

export type OrderItemInput = {
  productId: string;
  quantity: number;
};

export class CreateOnlineOrderDto {
  private constructor(
    public readonly items: OrderItemInput[],
    public readonly paymentMethod: OrderPaymentMethod,
    /** Texto legible; si el cliente no envía `shippingAddress`, se arma desde `shippingContact`. */
    public readonly shippingAddress: string,
    /** Obligatorio en checkout — datos para transportista (no en registro). */
    public readonly shippingContact: ShippingContactDto,
    // Guest fields (null when authenticated customer)
    public readonly guestName: string | null,
    public readonly guestPhone: string | null,
    public readonly guestEmail: string | null,
    /** Optional client-side fingerprint (e.g. FingerprintJS hash) for antifraud history */
    public readonly deviceFingerprintHash: string | null,
    /** P3 — uppercase normalized in use case */
    public readonly couponCode: string | null,
    /** P3 — must match ShippingZone.code seeded (e.g. BOGOTA) */
    public readonly shippingZoneCode: string | null,
    /** Solo respaldo si ningún producto del carrito tiene `weightKg` en catálogo (preferir peso en BD). */
    public readonly estimatedWeightKg: number | null,
    /** P3 — CustomerAddress.id for authenticated checkout */
    public readonly customerAddressId: string | null,
  ) {}

  static create(object: Record<string, unknown>): [string?, CreateOnlineOrderDto?] {
    const {
      items,
      paymentMethod,
      shippingAddress,
      shippingContact,
      guestName,
      guestPhone,
      guestEmail,
      deviceFingerprintHash,
      couponCode,
      shippingZoneCode,
      estimatedWeightKg,
      customerAddressId,
    } = object;

    const [contactErr, contactDto] = ShippingContactDto.create(shippingContact);
    if (contactErr || !contactDto) {
      return [contactErr ?? 'shippingContact inválido'];
    }

    // items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return ['items debe ser un arreglo no vacío'];
    }
    if (items.length > MAX_ITEMS) {
      return [`items no puede tener más de ${MAX_ITEMS} productos`];
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
      if (qty > MAX_QUANTITY) return [`items[${i}].quantity no puede ser mayor a ${MAX_QUANTITY}`];

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

    let resolvedShippingAddress: string;
    if (shippingAddress !== undefined && shippingAddress !== null && String(shippingAddress).trim().length > 0) {
      const sa = String(shippingAddress).trim();
      if (sa.length > MAX_SHIPPING_ADDRESS_LENGTH) {
        return [`shippingAddress no puede exceder ${MAX_SHIPPING_ADDRESS_LENGTH} caracteres`];
      }
      resolvedShippingAddress = sa;
    } else {
      resolvedShippingAddress = ShippingContactDto.formatSnapshotAddress(contactDto);
    }

    // Guest fields opcionales en body; invitado sigue requiriendo guestEmail en use case.
    let parsedGuestName: string | null = null;
    if (guestName !== undefined && guestName !== null) {
      if (typeof guestName !== 'string' || guestName.trim().length < 2) {
        return ['guestName debe tener al menos 2 caracteres si se envía'];
      }
      if (guestName.trim().length > MAX_GUEST_NAME_LENGTH) {
        return [`guestName no puede exceder ${MAX_GUEST_NAME_LENGTH} caracteres`];
      }
      parsedGuestName = guestName.trim();
    }

    let parsedGuestPhone: string | null = null;
    if (guestPhone !== undefined && guestPhone !== null) {
      if (typeof guestPhone !== 'string') {
        return ['guestPhone debe ser texto'];
      }
      if (guestPhone.trim().length > MAX_GUEST_PHONE_LENGTH) {
        return [`guestPhone no puede exceder ${MAX_GUEST_PHONE_LENGTH} caracteres`];
      }
      parsedGuestPhone = guestPhone.trim().length > 0 ? guestPhone.trim() : null;
    }

    let parsedGuestEmail: string | null = null;
    if (guestEmail !== undefined && guestEmail !== null) {
      if (typeof guestEmail !== 'string') {
        return ['guestEmail debe ser texto'];
      }
      const normalizedEmail = guestEmail.trim().toLowerCase();
      if (!regularExps.email.test(normalizedEmail)) {
        return ['guestEmail no tiene un formato válido'];
      }
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

    let parsedCoupon: string | null = null;
    if (couponCode !== undefined && couponCode !== null) {
      if (typeof couponCode !== 'string') return ['couponCode debe ser texto'];
      const c = couponCode.trim().toUpperCase();
      if (c.length > 40) return ['couponCode demasiado largo'];
      parsedCoupon = c.length > 0 ? c : null;
    }

    let parsedZone: string | null = null;
    if (shippingZoneCode !== undefined && shippingZoneCode !== null) {
      if (typeof shippingZoneCode !== 'string') return ['shippingZoneCode debe ser texto'];
      const z = shippingZoneCode.trim().toUpperCase();
      if (z.length > 40) return ['shippingZoneCode demasiado largo'];
      parsedZone = z.length > 0 ? z : null;
    }

    let parsedWeight: number | null = null;
    if (estimatedWeightKg !== undefined && estimatedWeightKg !== null) {
      const w = Number(estimatedWeightKg);
      if (!Number.isFinite(w) || w <= 0 || w > 500) {
        return ['estimatedWeightKg debe ser un número positivo razonable (máx 500 kg)'];
      }
      parsedWeight = Math.round(w * 100) / 100;
    }

    let parsedAddrId: string | null = null;
    if (customerAddressId !== undefined && customerAddressId !== null) {
      if (typeof customerAddressId !== 'string' || customerAddressId.trim().length === 0) {
        return ['customerAddressId inválido'];
      }
      parsedAddrId = customerAddressId.trim();
    }

    return [
      undefined,
      new CreateOnlineOrderDto(
        parsedItems,
        paymentMethod as OrderPaymentMethod,
        resolvedShippingAddress,
        contactDto,
        parsedGuestName,
        parsedGuestPhone,
        parsedGuestEmail,
        parsedFingerprint,
        parsedCoupon,
        parsedZone,
        parsedWeight,
        parsedAddrId,
      ),
    ];
  }
}
