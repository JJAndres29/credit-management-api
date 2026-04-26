import { PaginationDto } from '../dtos/shared';
import { PaginatedResult } from '../types/paginated.type';
import { OnlineOrderEntity } from '../entities/online-order.entity';
import { OnlineOrderCreateData, OnlineOrderFilters } from '../datasources/online-order.datasource';

export interface OnlineOrderRepository {
  create(data: OnlineOrderCreateData): Promise<OnlineOrderEntity>;
  findById(id: string): Promise<OnlineOrderEntity | null>;
  findByOrderNumberAndEmail(orderNumber: number, email: string): Promise<OnlineOrderEntity | null>;
  findAll(pagination: PaginationDto, filters: OnlineOrderFilters): Promise<PaginatedResult<OnlineOrderEntity>>;
}
