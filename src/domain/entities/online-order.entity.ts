export enum OrderStatus {
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  PAID = 'PAID',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
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
  ) {}

  toJSON() {
    return {
      id: this.id,
      orderId: this.orderId,
      productId: this.productId,
      quantity: this.quantity,
      unitPrice: this.unitPrice,
      productNameSnapshot: this.productNameSnapshot,
    };
  }

  static fromObject(object: Record<string, unknown>): OnlineOrderItemEntity {
    const { id, orderId, productId, quantity, unitPrice, productNameSnapshot } = object;
    if (!id) throw new Error('OnlineOrderItem id is required');
    return new OnlineOrderItemEntity(
      id as string,
      orderId as string,
      productId as string,
      Number(quantity),
      Number(unitPrice),
      productNameSnapshot as string,
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
      paymentMethod: this.paymentMethod,
      paymentGatewayReference: this.paymentGatewayReference,
      paymentUrl: this.paymentUrl,
      expiresAt: this.expiresAt,
      paidAt: this.paidAt,
      stockRestoredAt: this.stockRestoredAt,
      createdAt: this.createdAt,
      items: this.items.map((i) => i.toJSON()),
    };
  }

  static fromObject(object: Record<string, unknown>): OnlineOrderEntity {
    const {
      id, orderNumber, customerId, guestName, guestPhone, guestEmail,
      shippingAddress, status, totalAmount, paymentMethod,
      paymentGatewayReference, paymentUrl,
      expiresAt, paidAt, stockRestoredAt, createdAt, items, customer,
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
    );
  }
}
