import { SaleRepository } from '../../repositories';
import { FilterSalesDto } from '../../dtos/sales';
import { PaginationDto } from '../../dtos/shared';
import { PaginatedResult } from '../../types/paginated.type';
import { SaleEntity } from '../../entities';

export class GetSalesUseCase {
  constructor(private readonly saleRepository: SaleRepository) {}

  execute(pagination: PaginationDto, filters: FilterSalesDto): Promise<PaginatedResult<SaleEntity>> {
    return this.saleRepository.findAll(pagination, filters);
  }
}
