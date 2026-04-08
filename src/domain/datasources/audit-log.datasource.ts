import { AuditLogEntity } from '../entities';

/**
 * Datos necesarios para crear un registro de auditoría dentro de una transacción.
 * Este tipo es importado por SaleDatasource y PaymentDatasource para embeber
 * el log en la misma transacción atómica, garantizando consistencia total.
 */
export interface AuditLogData {
  userId: string;
  action: string;
  before: number;
  after: number;
  ip: string;
}

/**
 * Puerto de lectura del módulo AuditLog.
 * La escritura ocurre dentro de las transacciones de Sale y Payment,
 * por eso este datasource solo expone métodos de consulta.
 */
export interface AuditLogDatasource {
  findAll(): Promise<AuditLogEntity[]>;
  findByClientId(clientId: string): Promise<AuditLogEntity[]>;
}
