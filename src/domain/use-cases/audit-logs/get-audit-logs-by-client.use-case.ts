import { CustomError } from '../../errors';
import { AuditLogEntity } from '../../entities';
import { AuditLogRepository } from '../../repositories';
import { ClientRepository } from '../../repositories';

export class GetAuditLogsByClientUseCase {
  constructor(
    private readonly auditLogRepository: AuditLogRepository,
    private readonly clientRepository: ClientRepository,
  ) {}

  async execute(clientId: string): Promise<AuditLogEntity[]> {
    // Verificar que el cliente existe (activo o no) antes de retornar sus logs
    const client = await this.clientRepository.findById(clientId);
    if (!client) throw CustomError.notFound(`Cliente con ID ${clientId} no encontrado`);

    return this.auditLogRepository.findByClientId(clientId);
  }
}
