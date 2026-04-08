import { AuditLogRepository } from '../../domain/repositories/audit-log.repository';
import { AuditLogDatasource } from '../../domain/datasources/audit-log.datasource';
import { AuditLogEntity } from '../../domain/entities';

export class AuditLogRepositoryImpl implements AuditLogRepository {
  constructor(private readonly datasource: AuditLogDatasource) {}

  findAll(): Promise<AuditLogEntity[]> {
    return this.datasource.findAll();
  }

  findByClientId(clientId: string): Promise<AuditLogEntity[]> {
    return this.datasource.findByClientId(clientId);
  }
}
