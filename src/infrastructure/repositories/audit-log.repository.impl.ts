import { AuditLogRepository } from '../../domain/repositories/audit-log.repository';
import { AuditLogDatasource } from '../../domain/datasources/audit-log.datasource';
import { AuditLogEntity } from '../../domain/entities';
import { FilterAuditLogsDto } from '../../domain/dtos/audit-logs';
import { PaginationDto } from '../../domain/dtos/shared';
import { PaginatedResult } from '../../domain/types/paginated.type';

export class AuditLogRepositoryImpl implements AuditLogRepository {
  constructor(private readonly datasource: AuditLogDatasource) {}

  findAll(pagination: PaginationDto, filters: FilterAuditLogsDto): Promise<PaginatedResult<AuditLogEntity>> {
    return this.datasource.findAll(pagination, filters);
  }

  findByClientId(clientId: string): Promise<AuditLogEntity[]> {
    return this.datasource.findByClientId(clientId);
  }
}
