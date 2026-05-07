import { PaymentRepository } from '../../domain/repositories';
import { PaymentDatasource, PaymentCreateData, PaymentUpdateData, PaymentDeleteData } from '../../domain/datasources/payment.datasource';
import { PaymentEntity } from '../../domain/entities';
import { FilterPaymentsDto } from '../../domain/dtos/payments';
import { PaginationDto } from '../../domain/dtos/shared';
import { PaginatedResult } from '../../domain/types/paginated.type';

export class PaymentRepositoryImpl implements PaymentRepository {
  constructor(private readonly datasource: PaymentDatasource) {}

  findAll(pagination: PaginationDto, filters: FilterPaymentsDto): Promise<PaginatedResult<PaymentEntity>> {
    return this.datasource.findAll(pagination, filters);
  }

  findById(id: string): Promise<PaymentEntity | null> {
    return this.datasource.findById(id);
  }

  findByClientId(clientId: string): Promise<PaymentEntity[]> {
    return this.datasource.findByClientId(clientId);
  }

  findBySaleId(saleId: string): Promise<PaymentEntity[]> {
    return this.datasource.findBySaleId(saleId);
  }

  findBySaleIds(saleIds: string[]): Promise<PaymentEntity[]> {
    return this.datasource.findBySaleIds(saleIds);
  }

  create(data: PaymentCreateData): Promise<PaymentEntity> {
    return this.datasource.create(data);
  }

  update(id: string, data: PaymentUpdateData): Promise<PaymentEntity> {
    return this.datasource.update(id, data);
  }

  delete(id: string, data: PaymentDeleteData): Promise<PaymentEntity> {
    return this.datasource.delete(id, data);
  }
}
