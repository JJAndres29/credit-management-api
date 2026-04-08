import { prisma } from '../../config/prisma';
import { AuditLogDatasource } from '../../domain/datasources/audit-log.datasource';
import { AuditLogEntity } from '../../domain/entities';

function mapToEntity(log: Record<string, unknown>): AuditLogEntity {
  return AuditLogEntity.fromObject(log);
}

export class PrismaAuditLogDatasource implements AuditLogDatasource {
  async findAll(): Promise<AuditLogEntity[]> {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return logs.map((l) => mapToEntity(l as unknown as Record<string, unknown>));
  }

  async findByClientId(clientId: string): Promise<AuditLogEntity[]> {
    const logs = await prisma.auditLog.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    });

    return logs.map((l) => mapToEntity(l as unknown as Record<string, unknown>));
  }
}
