import { Router } from 'express';
import { AuditLogController } from './audit-log.controller';
import { GetAuditLogsUseCase, GetAuditLogsByClientUseCase } from '../../domain/use-cases/audit-logs';
import { AuditLogRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaAuditLogDatasource } from '../../infrastructure/datasources';
import { ClientRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaClientDatasource } from '../../infrastructure/datasources';
import { AuthRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaAuthDatasource } from '../../infrastructure/datasources';
import { AuthMiddleware } from '../middlewares';
import { checkRole } from '../middlewares';
import { JwtAdapter } from '../../infrastructure/services';
import { Role } from '../../domain/entities';

export class AuditLogRouter {
  static get routes(): Router {
    const router = Router();

    const auditLogRepository = new AuditLogRepositoryImpl(new PrismaAuditLogDatasource());
    const clientRepository = new ClientRepositoryImpl(new PrismaClientDatasource());

    const controller = new AuditLogController(
      new GetAuditLogsUseCase(auditLogRepository),
      new GetAuditLogsByClientUseCase(auditLogRepository, clientRepository),
    );

    const middleware = new AuthMiddleware(
      new JwtAdapter(),
      new AuthRepositoryImpl(new PrismaAuthDatasource()),
    );

    // JWT obligatorio + solo ADMIN puede consultar logs de auditoría
    router.use(middleware.validateJwt);
    router.use(checkRole(Role.ADMIN));

    // GET /api/audit-logs
    router.get('/', controller.getAll);

    // GET /api/audit-logs/client/:clientId
    // Va ANTES de /:id para que Express no confunda "client" con otro segmento
    router.get('/client/:clientId', controller.getByClient);

    return router;
  }
}
