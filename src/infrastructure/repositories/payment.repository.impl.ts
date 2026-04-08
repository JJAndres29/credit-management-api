import { PaymentRepository } from '../../domain/repositories';
import { PaymentDatasource, PaymentCreateData } from '../../domain/datasources/payment.datasource';
import { PaymentEntity } from '../../domain/entities';

export class PaymentRepositoryImpl implements PaymentRepository {
  constructor(private readonly datasource: PaymentDatasource) {}

  findAll(): Promise<PaymentEntity[]> {
    return this.datasource.findAll();
  }

  findById(id: string): Promise<PaymentEntity | null> {
    return this.datasource.findById(id);
  }

  findByClientId(clientId: string): Promise<PaymentEntity[]> {
    return this.datasource.findByClientId(clientId);
  }

  findBySaleId(saleId: string): Promise<PaymentEntity[]> {
    return this.datasource.findBySaleId(saleId);
  }

  create(data: PaymentCreateData): Promise<PaymentEntity> {
    return this.datasource.create(data);
  }
}
