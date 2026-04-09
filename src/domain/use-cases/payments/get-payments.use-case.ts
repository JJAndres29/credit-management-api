import { PaymentRepository } from '../../repositories';
import { FilterPaymentsDto } from '../../dtos/payments';
import { PaginationDto } from '../../dtos/shared';
import { PaginatedResult } from '../../types/paginated.type';
import { PaymentEntity } from '../../entities';

export class GetPaymentsUseCase {
  constructor(private readonly paymentRepository: PaymentRepository) {}

  execute(pagination: PaginationDto, filters: FilterPaymentsDto): Promise<PaginatedResult<PaymentEntity>> {
    return this.paymentRepository.findAll(pagination, filters);
  }
}
