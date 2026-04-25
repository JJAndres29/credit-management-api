import { CustomerRepository } from '../../repositories';
import { FilterCustomersDto } from '../../dtos/customer-auth';
import { PaginationDto } from '../../dtos/shared';
import { PaginatedResult } from '../../types/paginated.type';
import { CustomerEntity } from '../../entities';

export class GetCustomersUseCase {
  constructor(private readonly customerRepository: CustomerRepository) {}

  async execute(
    pagination: PaginationDto,
    filters: FilterCustomersDto,
  ): Promise<PaginatedResult<ReturnType<CustomerEntity['toJSON']>>> {
    const result = await this.customerRepository.findAll(pagination, {
      search: filters.search,
      isActive: filters.isActive,
    });

    return {
      data: result.data.map((c) => c.toJSON()),
      pagination: result.pagination,
    };
  }
}
