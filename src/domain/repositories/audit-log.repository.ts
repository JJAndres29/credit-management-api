import { AuditLogEntity } from '../entities';

export interface AuditLogRepository {
  findAll(): Promise<AuditLogEntity[]>;
  findByClientId(clientId: string): Promise<AuditLogEntity[]>;
}
