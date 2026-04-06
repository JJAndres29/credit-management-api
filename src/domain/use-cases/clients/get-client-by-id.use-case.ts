import { CustomError } from '../../errors';
import { ClientEntity } from '../../entities';
import { ClientRepository } from '../../repositories';

export class GetClientByIdUseCase {
  constructor(private readonly clientRepository: ClientRepository) {}

  async execute(id: string): Promise<ClientEntity> {
    const client = await this.clientRepository.findById(id);

    if (!client) throw CustomError.notFound(`Client with id ${id} not found`);

    return client;
  }
}
