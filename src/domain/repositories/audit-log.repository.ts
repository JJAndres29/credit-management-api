import { AuditLogEntity } from '../entities';
import { FilterAuditLogsDto } from '../dtos/audit-logs';
import { PaginationDto } from '../dtos/shared';
import { PaginatedResult } from '../types/paginated.type';

export interface AuditLogRepository {
  findAll(pagination: PaginationDto, filters: FilterAuditLogsDto): Promise<PaginatedResult<AuditLogEntity>>;
  findByClientId(clientId: string): Promise<AuditLogEntity[]>;
}
