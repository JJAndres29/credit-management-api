import { PaymentEntity } from '../entities';
import { AuditLogData } from './audit-log.datasource';
import { FilterPaymentsDto } from '../dtos/payments';
import { PaginationDto } from '../dtos/shared';
import { PaginatedResult } from '../types/paginated.type';

/**
 * Datos ya validados y enriquecidos que llegan desde el use case.
 * saleTotal se incluye cuando hay saleId para que la transacción atómica
 * pueda calcular el nuevo estado de la venta sin salir de la transacción.
 *
 * `auditLog` siempre está presente en pagos porque todos modifican el balance.
 */
export interface PaymentCreateData {
  clientId: string;
  saleId: string | null;
  amount: number;
  note: string | null;
  /** Total de la venta, requerido cuando saleId está presente */
  saleTotal?: number;
  auditLog: AuditLogData;
}

export interface PaymentDatasource {
  findAll(pagination: PaginationDto, filters: FilterPaymentsDto): Promise<PaginatedResult<PaymentEntity>>;
  findById(id: string): Promise<PaymentEntity | null>;
  findByClientId(clientId: string): Promise<PaymentEntity[]>;
  findBySaleId(saleId: string): Promise<PaymentEntity[]>;
  /**
   * Crea el pago, decrementa el balance del cliente y (si hay saleId)
   * recalcula el estado de la venta — todo en una transacción atómica.
   */
  create(data: PaymentCreateData): Promise<PaymentEntity>;
}
