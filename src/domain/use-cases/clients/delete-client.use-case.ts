import { CustomError } from '../../errors';
import { ClientEntity } from '../../entities';
import { ClientRepository } from '../../repositories';

export class DeleteClientUseCase {
  constructor(private readonly clientRepository: ClientRepository) {}

  async execute(id: string): Promise<ClientEntity> {
    const existing = await this.clientRepository.findById(id);
    if (!existing) throw CustomError.notFound(`Client with id ${id} not found`);

    return this.clientRepository.delete(id);
  }
}
