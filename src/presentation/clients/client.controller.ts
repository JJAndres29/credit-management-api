import { Request, Response } from 'express';
import { CustomError } from '../../domain/errors';
import { CreateClientDto, UpdateClientDto } from '../../domain/dtos/clients';
import { CreateClientUseCase } from '../../domain/use-cases/clients/create-client.use-case';
import { GetClientsUseCase } from '../../domain/use-cases/clients/get-clients.use-case';
import { GetClientByIdUseCase } from '../../domain/use-cases/clients/get-client-by-id.use-case';
import { UpdateClientUseCase } from '../../domain/use-cases/clients/update-client.use-case';
import { DeleteClientUseCase } from '../../domain/use-cases/clients/delete-client.use-case';

export class ClientController {
  constructor(
    private readonly createClientUseCase: CreateClientUseCase,
    private readonly getClientsUseCase: GetClientsUseCase,
    private readonly getClientByIdUseCase: GetClientByIdUseCase,
    private readonly updateClientUseCase: UpdateClientUseCase,
    private readonly deleteClientUseCase: DeleteClientUseCase,
  ) {}

  getAll = async (_req: Request, res: Response): Promise<void> => {
    try {
      const clients = await this.getClientsUseCase.execute();
      res.json(clients);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    try {
      const client = await this.getClientByIdUseCase.execute(req.params.id);
      res.json(client);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const [error, dto] = CreateClientDto.create(req.body as Record<string, unknown>);

    if (error) {
      res.status(400).json({ error });
      return;
    }

    try {
      const client = await this.createClientUseCase.execute(dto!);
      res.status(201).json(client);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const [error, dto] = UpdateClientDto.create(req.body as Record<string, unknown>);

    if (error) {
      res.status(400).json({ error });
      return;
    }

    try {
      const client = await this.updateClientUseCase.execute(req.params.id, dto!);
      res.json(client);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    try {
      const client = await this.deleteClientUseCase.execute(req.params.id);
      res.json(client);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  private handleError(error: unknown, res: Response): void {
    if (error instanceof CustomError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}
