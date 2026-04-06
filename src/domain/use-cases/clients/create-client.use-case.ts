import { CustomError } from '../../errors';
import { ClientEntity } from '../../entities';
import { CreateClientDto } from '../../dtos/clients';
import { ClientRepository } from '../../repositories';

export class CreateClientUseCase {
  constructor(private readonly clientRepository: ClientRepository) {}

  async execute(dto: CreateClientDto): Promise<ClientEntity> {
    if (dto.email) {
      const existing = await this.clientRepository.findByEmail(dto.email);
      if (existing) throw CustomError.conflict(`Email ${dto.email} is already registered`);
    }

    return this.clientRepository.create(dto);
  }
}
