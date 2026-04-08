import { SaleDatasource, SaleCreateData } from '../../domain/datasources/sale.datasource';
import { SaleRepository } from '../../domain/repositories';
import { SaleEntity } from '../../domain/entities';

export class SaleRepositoryImpl implements SaleRepository {
  constructor(private readonly datasource: SaleDatasource) {}

  findAll(): Promise<SaleEntity[]> {
    return this.datasource.findAll();
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
}
