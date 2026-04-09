import { prisma } from '../../config/prisma';
import { AuditLogDatasource } from '../../domain/datasources/audit-log.datasource';
import { AuditLogEntity } from '../../domain/entities';
import { FilterAuditLogsDto } from '../../domain/dtos/audit-logs';
import { PaginationDto } from '../../domain/dtos/shared';
import { PaginatedResult } from '../../domain/types/paginated.type';

function mapToEntity(log: Record<string, unknown>): AuditLogEntity {
  return AuditLogEntity.fromObject(log);
}

function buildWhere(filters: FilterAuditLogsDto) {
  return {
    ...(filters.clientId && { clientId: filters.clientId }),
    ...(filters.userId && { userId: filters.userId }),
    ...(filters.action && { action: filters.action }),
    ...((filters.dateFrom || filters.dateTo) && {
      createdAt: {
        ...(filters.dateFrom && { gte: filters.dateFrom }),
        ...(filters.dateTo && { lte: filters.dateTo }),
      },
    }),
  };
}

export class PrismaAuditLogDatasource implements AuditLogDatasource {
  async findAll(pagination: PaginationDto, filters: FilterAuditLogsDto): Promise<PaginatedResult<AuditLogEntity>> {
    const where = buildWhere(filters);

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs.map((l) => mapToEntity(l as unknown as Record<string, unknown>)),
      pagination: {
        total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(total / pagination.limit),
        hasNextPage: pagination.page * pagination.limit < total,
        hasPrevPage: pagination.page > 1,
      },
    };
  }

  async findByClientId(clientId: string): Promise<AuditLogEntity[]> {
    const logs = await prisma.auditLog.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    });

    return logs.map((l) => mapToEntity(l as unknown as Record<string, unknown>));
  }
}
