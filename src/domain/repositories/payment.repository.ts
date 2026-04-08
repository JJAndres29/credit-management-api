import { PaymentEntity } from '../entities';
import { PaymentCreateData } from '../datasources/payment.datasource';

export interface PaymentRepository {
  findAll(): Promise<PaymentEntity[]>;
  findById(id: string): Promise<PaymentEntity | null>;
  findByClientId(clientId: string): Promise<PaymentEntity[]>;
  findBySaleId(saleId: string): Promise<PaymentEntity[]>;
  create(data: PaymentCreateData): Promise<PaymentEntity>;
}
