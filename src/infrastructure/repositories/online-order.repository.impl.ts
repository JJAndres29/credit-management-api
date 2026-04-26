import { OnlineOrderRepository } from '../../domain/repositories/online-order.repository';
import { OnlineOrderDatasource, OnlineOrderCreateData, OnlineOrderFilters } from '../../domain/datasources/online-order.datasource';
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
}
