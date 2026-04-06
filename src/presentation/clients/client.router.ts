import { Router } from 'express';
import { ClientController } from './client.controller';
import { CreateClientUseCase, GetClientsUseCase, GetClientByIdUseCase, UpdateClientUseCase, DeleteClientUseCase } from '../../domain/use-cases/clients';
import { ClientRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaClientDatasource } from '../../infrastructure/datasources';
import { AuthMiddleware, checkRole } from '../middlewares';
import { JwtAdapter } from '../../infrastructure/services';
import { AuthRepositoryImpl } from '../../infrastructure/repositories';
import { PrismaAuthDatasource } from '../../infrastructure/datasources';
import { Role } from '../../domain/entities'; 

export class ClientRouter {
  static get routes(): Router {
    const router = Router();

    const repository = new ClientRepositoryImpl(new PrismaClientDatasource());

    const controller = new ClientController(
      new CreateClientUseCase(repository),
      new GetClientsUseCase(repository),
      new GetClientByIdUseCase(repository),
      new UpdateClientUseCase(repository),
      new DeleteClientUseCase(repository),
    );

    const middleware = new AuthMiddleware(
      new JwtAdapter(),
      new AuthRepositoryImpl(new PrismaAuthDatasource()),
    );

    router.use(middleware.validateJwt);

    // GET  /api/clients
    router.get('/', controller.getAll);

    // GET  /api/clients/:id
    router.get('/:id', controller.getById);

    // POST /api/clients
    router.post('/', controller.create);

    // PUT  /api/clients/:id
    router.put('/:id', controller.update);

    // DELETE /api/clients/:id
    router.delete('/:id', checkRole(Role.ADMIN), controller.delete);

    return router;
  }
}
