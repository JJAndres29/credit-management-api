export enum OrderStatus {
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  PAID = 'PAID',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  RETURNED = 'RETURNED',
  REFUNDED = 'REFUNDED',
}

export enum OrderPaymentMethod {
  ONLINE_GATEWAY = 'ONLINE_GATEWAY',
  WHATSAPP_MANUAL = 'WHATSAPP_MANUAL',
}

export class OnlineOrderItemEntity {
  constructor(
    public readonly id: string,
    public readonly orderId: string,
    public readonly productId: string,
    public readonly quantity: number,
    public readonly unitPrice: number,
    public readonly productNameSnapshot: string,
    public readonly variantId: string | null = null,
  ) {}

  toJSON() {
    return {
      id: this.id,
      orderId: this.orderId,
      productId: this.productId,
      variantId: this.variantId,
      quantity: this.quantity,
      unitPrice: this.unitPrice,
      productNameSnapshot: this.productNameSnapshot,
    };
  }

  static fromObject(object: Record<string, unknown>): OnlineOrderItemEntity {
    const { id, orderId, productId, quantity, unitPrice, productNameSnapshot, variantId } = object;
    if (!id) throw new Error('OnlineOrderItem id is required');
    return new OnlineOrderItemEntity(
      id as string,
      orderId as string,
      productId as string,
      Number(quantity),
      Number(unitPrice),
      productNameSnapshot as string,
      (variantId as string | null | undefined) ?? null,
    );
  }
}

export type OrderCustomerSnapshot = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
};

export class OnlineOrderEntity {
  constructor(
    public readonly id: string,
    public readonly orderNumber: number,
    public readonly customerId: string | null,
    public readonly guestName: string | null,
    public readonly guestPhone: string | null,
    public readonly guestEmail: string | null,
    public readonly shippingAddress: string,
    public readonly status: OrderStatus,
    public readonly totalAmount: number,
    public readonly paymentMethod: OrderPaymentMethod,
    public readonly expiresAt: Date | null,
    public readonly paidAt: Date | null,
    public readonly createdAt: Date,
    public readonly items: OnlineOrderItemEntity[],
    public readonly paymentGatewayReference: string | null,
    public readonly paymentUrl: string | null,
    public readonly customer: OrderCustomerSnapshot | null,
    public readonly stockRestoredAt: Date | null = null,
    public readonly ipAddress: string | null = null,
    public readonly userAgent: string | null = null,
    public readonly deviceFingerprintHash: string | null = null,
    public readonly subtotalAmount: number | null = null,
    public readonly taxAmount: number | null = null,
    public readonly shippingAmount: number | null = null,
    public readonly discountAmount: number | null = null,
    public readonly currencyCode: string = 'COP',
  ) {}

  toJSON() {
    return {
      id: this.id,
      orderNumber: this.orderNumber,
      customerId: this.customerId,
      customer: this.customer,
      guestName: this.guestName,
      guestPhone: this.guestPhone,
      guestEmail: this.guestEmail,
      shippingAddress: this.shippingAddress,
      status: this.status,
      totalAmount: this.totalAmount,
      subtotalAmount: this.subtotalAmount,
      taxAmount: this.taxAmount,
      shippingAmount: this.shippingAmount,
      discountAmount: this.discountAmount,
      currencyCode: this.currencyCode,
      paymentMethod: this.paymentMethod,
      paymentGatewayReference: this.paymentGatewayReference,
      paymentUrl: this.paymentUrl,
      expiresAt: this.expiresAt,
      paidAt: this.paidAt,
      stockRestoredAt: this.stockRestoredAt,
      ipAddress: this.ipAddress,
      userAgent: this.userAgent,
      deviceFingerprintHash: this.deviceFingerprintHash,
      createdAt: this.createdAt,
      items: this.items.map((i) => i.toJSON()),
    };
  }

  static fromObject(object: Record<string, unknown>): OnlineOrderEntity {
    const {
      id, orderNumber, customerId, guestName, guestPhone, guestEmail,
      shippingAddress, status, totalAmount, paymentMethod,
      paymentGatewayReference, paymentUrl,
      expiresAt, paidAt, stockRestoredAt, ipAddress, userAgent, deviceFingerprintHash,
      createdAt, items, customer,
      subtotalAmount, taxAmount, shippingAmount, discountAmount, currencyCode,
    } = object;

    if (!id) throw new Error('OnlineOrder id is required');

    const parsedItems = Array.isArray(items)
      ? items.map((i) => OnlineOrderItemEntity.fromObject(i as Record<string, unknown>))
      : [];

    const parsedCustomer = customer && typeof customer === 'object'
      ? (customer as OrderCustomerSnapshot)
      : null;

    return new OnlineOrderEntity(
      id as string,
      Number(orderNumber),
      (customerId as string | null | undefined) ?? null,
      (guestName as string | null | undefined) ?? null,
      (guestPhone as string | null | undefined) ?? null,
      (guestEmail as string | null | undefined) ?? null,
      shippingAddress as string,
      status as OrderStatus,
      Number(totalAmount),
      paymentMethod as OrderPaymentMethod,
      expiresAt ? new Date(expiresAt as string | Date) : null,
      paidAt ? new Date(paidAt as string | Date) : null,
      new Date(createdAt as string | Date),
      parsedItems,
      (paymentGatewayReference as string | null | undefined) ?? null,
      (paymentUrl as string | null | undefined) ?? null,
      parsedCustomer,
      stockRestoredAt ? new Date(stockRestoredAt as string | Date) : null,
      (ipAddress as string | null | undefined) ?? null,
      (userAgent as string | null | undefined) ?? null,
      (deviceFingerprintHash as string | null | undefined) ?? null,
      subtotalAmount != null ? Number(subtotalAmount) : null,
      taxAmount != null ? Number(taxAmount) : null,
      shippingAmount != null ? Number(shippingAmount) : null,
      discountAmount != null ? Number(discountAmount) : null,
      (currencyCode as string | undefined) ?? 'COP',
    );
  }
}
