import { PaginatedResult } from '../../types/paginated.type';
import { OnlineOrderEntity } from '../../entities/online-order.entity';
import { OnlineOrderRepository } from '../../repositories/online-order.repository';
import { PaginationDto } from '../../dtos/shared';
import { FilterOnlineOrdersDto } from '../../dtos/online-orders';

export class GetOnlineOrdersUseCase {
  constructor(private readonly onlineOrderRepository: OnlineOrderRepository) {}

  execute(
    pagination: PaginationDto,
    filters: FilterOnlineOrdersDto,
  ): Promise<PaginatedResult<OnlineOrderEntity>> {
    return this.onlineOrderRepository.findAll(pagination, filters);
  }
}
