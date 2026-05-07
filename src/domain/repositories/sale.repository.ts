import { SaleEntity } from '../entities';
import { SaleCreateData, SaleUpdateData, SaleDeleteData } from '../datasources/sale.datasource';
import { FilterSalesDto } from '../dtos/sales';
import { PaginationDto } from '../dtos/shared';
import { PaginatedResult } from '../types/paginated.type';

export interface SaleRepository {
  findAll(pagination: PaginationDto, filters: FilterSalesDto): Promise<PaginatedResult<SaleEntity>>;
  findById(id: string): Promise<SaleEntity | null>;
  findByClientId(clientId: string): Promise<SaleEntity[]>;
  findActiveCreditSales(clientId?: string): Promise<SaleEntity[]>;
  create(data: SaleCreateData): Promise<SaleEntity>;
  update(id: string, data: SaleUpdateData): Promise<SaleEntity>;
  delete(id: string, data: SaleDeleteData): Promise<SaleEntity>;
}
