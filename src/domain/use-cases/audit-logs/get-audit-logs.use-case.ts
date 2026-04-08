import { AuditLogEntity } from '../../entities';
import { AuditLogRepository } from '../../repositories';

export class GetAuditLogsUseCase {
  constructor(private readonly auditLogRepository: AuditLogRepository) {}

  execute(): Promise<AuditLogEntity[]> {
    return this.auditLogRepository.findAll();
  }
}
