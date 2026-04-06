import { CustomError } from '../../errors';
import { ClientEntity } from '../../entities';
import { UpdateClientDto } from '../../dtos/clients';
import { ClientRepository } from '../../repositories';

export class UpdateClientUseCase {
  constructor(private readonly clientRepository: ClientRepository) {}

  async execute(id: string, dto: UpdateClientDto): Promise<ClientEntity> {
    const existing = await this.clientRepository.findById(id);
    if (!existing) throw CustomError.notFound(`Client with id ${id} not found`);

    if (dto.email && dto.email !== existing.email) {
      const emailTaken = await this.clientRepository.findByEmail(dto.email);
      if (emailTaken) throw CustomError.conflict(`Email ${dto.email} is already registered`);
    }

    return this.clientRepository.update(id, dto);
  }
}
