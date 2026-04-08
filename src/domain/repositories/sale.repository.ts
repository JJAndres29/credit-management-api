import { SaleEntity } from '../entities';
import { SaleCreateData } from '../datasources/sale.datasource';

export interface SaleRepository {
  findAll(): Promise<SaleEntity[]>;
  findById(id: string): Promise<SaleEntity | null>;
  findByClientId(clientId: string): Promise<SaleEntity[]>;
  create(data: SaleCreateData): Promise<SaleEntity>;
}
