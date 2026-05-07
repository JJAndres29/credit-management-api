import { PaginationDto } from '../dtos/shared';
import { PaginatedResult } from '../types/paginated.type';
import { OnlineOrderEntity } from '../entities/online-order.entity';
import { OnlineOrderCreateData, OnlineOrderFilters, WebhookData } from '../datasources/online-order.datasource';

export interface OnlineOrderRepository {
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
  tryCancelOrExpirePending(
    id: string,
    newStatus: 'CANCELLED' | 'EXPIRED',
  ): Promise<OnlineOrderEntity | null>;
  markStockRestored(id: string): Promise<void>;
  findExpiredPending(now: Date, limit?: number): Promise<OnlineOrderEntity[]>;
}
