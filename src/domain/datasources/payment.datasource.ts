import { PaymentEntity } from '../entities';
import { AuditLogData } from './audit-log.datasource';
import { FilterPaymentsDto } from '../dtos/payments';
import { PaginationDto } from '../dtos/shared';
import { PaginatedResult } from '../types/paginated.type';

/**
 * Datos para actualizar un pago existente.
 * Solo los campos proporcionados se modifican.
 * Si `amount` cambia, `auditLog` es obligatorio para registrar el ajuste de balance.
 */
export interface PaymentUpdateData {
  amount?: number;
  note?: string | null;
  /** Total de la venta — requerido cuando amount cambia y el pago tiene saleId */
  saleTotal?: number;
  /** Requerido cuando amount cambia — registra el ajuste de balance */
  auditLog?: AuditLogData;
}

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

/**
 * Datos para eliminar un pago existente.
 * La transacción revierte el balance del cliente y recalcula el estado de la venta.
 */
export interface PaymentDeleteData {
  /** Total de la venta — requerido cuando el pago tiene saleId */
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
  /**
   * Actualiza el pago y (si amount cambia) ajusta el balance del cliente
   * y recalcula el estado de la venta — todo en una transacción atómica.
   * Solo ADMIN puede invocar este flujo.
   */
  update(id: string, data: PaymentUpdateData): Promise<PaymentEntity>;
  /**
   * Elimina el pago, revierte el balance del cliente y (si hay saleId)
   * recalcula el estado de la venta — todo en una transacción atómica.
   * Solo ADMIN puede invocar este flujo.
   */
  delete(id: string, data: PaymentDeleteData): Promise<PaymentEntity>;
}
