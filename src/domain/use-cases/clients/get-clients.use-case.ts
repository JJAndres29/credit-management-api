import { ClientEntity } from '../../entities';
import { ClientRepository } from '../../repositories';

export class GetClientsUseCase {
  constructor(private readonly clientRepository: ClientRepository) {}

  async execute(): Promise<ClientEntity[]> {
    return this.clientRepository.findAll();
  }
}
