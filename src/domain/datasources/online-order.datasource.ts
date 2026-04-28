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
}
