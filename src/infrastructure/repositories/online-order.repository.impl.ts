import { OnlineOrderRepository } from '../../domain/repositories/online-order.repository';
import {
  OnlineOrderDatasource,
  OnlineOrderCreateData,
  OnlineOrderFilters,
  WebhookData,
} from '../../domain/datasources/online-order.datasource';
import { OnlineOrderEntity } from '../../domain/entities/online-order.entity';
import { PaginationDto } from '../../domain/dtos/shared';
import { PaginatedResult } from '../../domain/types/paginated.type';

export class OnlineOrderRepositoryImpl implements OnlineOrderRepository {
  constructor(private readonly datasource: OnlineOrderDatasource) {}

  create(data: OnlineOrderCreateData): Promise<OnlineOrderEntity> {
    return this.datasource.create(data);
  }

  findById(id: string): Promise<OnlineOrderEntity | null> {
    return this.datasource.findById(id);
  }

  findByOrderNumberAndEmail(orderNumber: number, email: string): Promise<OnlineOrderEntity | null> {
    return this.datasource.findByOrderNumberAndEmail(orderNumber, email);
  }

  findAll(pagination: PaginationDto, filters: OnlineOrderFilters): Promise<PaginatedResult<OnlineOrderEntity>> {
    return this.datasource.findAll(pagination, filters);
  }

  updatePaymentLink(id: string, paymentUrl: string, gatewayReference: string): Promise<OnlineOrderEntity> {
    return this.datasource.updatePaymentLink(id, paymentUrl, gatewayReference);
  }

  markAsPaid(id: string, webhookData: WebhookData): Promise<OnlineOrderEntity> {
    return this.datasource.markAsPaid(id, webhookData);
  }

  markAsCancelled(id: string, webhookData: WebhookData): Promise<OnlineOrderEntity> {
    return this.datasource.markAsCancelled(id, webhookData);
  }

  webhookExists(provider: string, eventId: string): Promise<boolean> {
    return this.datasource.webhookExists(provider, eventId);
  }

  tryClaimProcessedWebhook(data: WebhookData): Promise<boolean> {
    return this.datasource.tryClaimProcessedWebhook(data);
  }

  releaseProcessedWebhookClaim(data: WebhookData): Promise<void> {
    return this.datasource.releaseProcessedWebhookClaim(data);
  }

  saveProcessedWebhook(data: WebhookData): Promise<void> {
    return this.datasource.saveProcessedWebhook(data);
  }

  updateStatus(id: string, status: string): Promise<OnlineOrderEntity> {
    return this.datasource.updateStatus(id, status);
  }

  tryCancelOrExpirePending(
    id: string,
    newStatus: 'CANCELLED' | 'EXPIRED',
  ): Promise<OnlineOrderEntity | null> {
    return this.datasource.tryCancelOrExpirePending(id, newStatus);
  }

  markStockRestored(id: string): Promise<void> {
    return this.datasource.markStockRestored(id);
  }

  findExpiredPending(now: Date, limit?: number): Promise<OnlineOrderEntity[]> {
    return this.datasource.findExpiredPending(now, limit);
  }
}
