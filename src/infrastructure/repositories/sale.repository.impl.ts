import { SaleDatasource, SaleCreateData, SaleUpdateData, SaleDeleteData } from '../../domain/datasources/sale.datasource';
import { SaleRepository } from '../../domain/repositories';
import { SaleEntity } from '../../domain/entities';
import { FilterSalesDto } from '../../domain/dtos/sales';
import { PaginationDto } from '../../domain/dtos/shared';
import { PaginatedResult } from '../../domain/types/paginated.type';

export class SaleRepositoryImpl implements SaleRepository {
  constructor(private readonly datasource: SaleDatasource) {}

  findAll(pagination: PaginationDto, filters: FilterSalesDto): Promise<PaginatedResult<SaleEntity>> {
    return this.datasource.findAll(pagination, filters);
  }

  findById(id: string): Promise<SaleEntity | null> {
    return this.datasource.findById(id);
  }

  findByClientId(clientId: string): Promise<SaleEntity[]> {
    return this.datasource.findByClientId(clientId);
  }

  create(data: SaleCreateData): Promise<SaleEntity> {
    return this.datasource.create(data);
  }

  update(id: string, data: SaleUpdateData): Promise<SaleEntity> {
    return this.datasource.update(id, data);
  }

  delete(id: string, data: SaleDeleteData): Promise<SaleEntity> {
    return this.datasource.delete(id, data);
  }
}
