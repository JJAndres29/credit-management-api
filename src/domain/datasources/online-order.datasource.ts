import { PaginationDto } from '../dtos/shared';
import { PaginatedResult } from '../types/paginated.type';
import { OnlineOrderEntity } from '../entities/online-order.entity';

export type OnlineOrderItemCreateData = {
  productId: string;
  quantity: number;
  unitPrice: number;
  productNameSnapshot: string;
};

export type OnlineOrderCreateData = {
  customerId: string | null;
  guestName: string | null;
  guestPhone: string | null;
  guestEmail: string | null;
  shippingAddress: string;
  totalAmount: number;
  paymentMethod: string;
  expiresAt: Date;
  items: OnlineOrderItemCreateData[];
};

export type OnlineOrderFilters = {
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
  customerId?: string;
};

export type WebhookData = {
  provider: string;
  eventId: string;
};

export interface OnlineOrderDatasource {
  create(data: OnlineOrderCreateData): Promise<OnlineOrderEntity>;
  findById(id: string): Promise<OnlineOrderEntity | null>;
  findByOrderNumberAndEmail(orderNumber: number, email: string): Promise<OnlineOrderEntity | null>;
  findAll(pagination: PaginationDto, filters: OnlineOrderFilters): Promise<PaginatedResult<OnlineOrderEntity>>;
  updatePaymentLink(id: string, paymentUrl: string, gatewayReference: string): Promise<OnlineOrderEntity>;
  markAsPaid(id: string, webhookData: WebhookData): Promise<OnlineOrderEntity>;
  markAsCancelled(id: string, webhookData: WebhookData): Promise<OnlineOrderEntity>;
  webhookExists(provider: string, eventId: string): Promise<boolean>;
  saveProcessedWebhook(data: WebhookData): Promise<void>;
  updateStatus(id: string, status: string): Promise<OnlineOrderEntity>;

  /**
   * Conditional transition: PENDING_PAYMENT → CANCELLED | EXPIRED.
   * Atomic guard against concurrent webhook updates.
   * Returns the updated order, or `null` if the order was no longer in
   * PENDING_PAYMENT (already paid, cancelled, or expired by someone else).
   */
  tryCancelOrExpirePending(
    id: string,
    newStatus: 'CANCELLED' | 'EXPIRED',
  ): Promise<OnlineOrderEntity | null>;

  /**
   * Idempotent marker: set `stockRestoredAt = NOW()` only if it was NULL.
   * Called after `incrementStock` succeeds for every item of the order.
   */
  markStockRestored(id: string): Promise<void>;

  /**
   * Returns orders in PENDING_PAYMENT whose `expiresAt` has passed.
   * Used by the expiry job. Caller is responsible for invoking
   * `tryCancelOrExpirePending` per order to handle race with webhooks.
   */
  findExpiredPending(now: Date, limit?: number): Promise<OnlineOrderEntity[]>;
}
