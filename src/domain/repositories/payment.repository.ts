import { PaymentEntity } from '../entities';
import { PaymentCreateData, PaymentUpdateData, PaymentDeleteData } from '../datasources/payment.datasource';
import { FilterPaymentsDto } from '../dtos/payments';
import { PaginationDto } from '../dtos/shared';
import { PaginatedResult } from '../types/paginated.type';

export interface PaymentRepository {
  findAll(pagination: PaginationDto, filters: FilterPaymentsDto): Promise<PaginatedResult<PaymentEntity>>;
  findById(id: string): Promise<PaymentEntity | null>;
  findByClientId(clientId: string): Promise<PaymentEntity[]>;
  findBySaleId(saleId: string): Promise<PaymentEntity[]>;
  create(data: PaymentCreateData): Promise<PaymentEntity>;
  update(id: string, data: PaymentUpdateData): Promise<PaymentEntity>;
  delete(id: string, data: PaymentDeleteData): Promise<PaymentEntity>;
}
