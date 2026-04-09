import { AuditLogRepository } from '../../repositories';
import { FilterAuditLogsDto } from '../../dtos/audit-logs';
import { PaginationDto } from '../../dtos/shared';
import { PaginatedResult } from '../../types/paginated.type';
import { AuditLogEntity } from '../../entities';

export class GetAuditLogsUseCase {
  constructor(private readonly auditLogRepository: AuditLogRepository) {}

  execute(pagination: PaginationDto, filters: FilterAuditLogsDto): Promise<PaginatedResult<AuditLogEntity>> {
    return this.auditLogRepository.findAll(pagination, filters);
  }
}
