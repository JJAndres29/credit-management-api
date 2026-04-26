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

  saveProcessedWebhook(data: WebhookData): Promise<void> {
    return this.datasource.saveProcessedWebhook(data);
  }
}
