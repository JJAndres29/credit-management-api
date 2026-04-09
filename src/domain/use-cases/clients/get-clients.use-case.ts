import { ClientRepository } from '../../repositories';
import { FilterClientsDto } from '../../dtos/clients';
import { PaginationDto } from '../../dtos/shared';
import { PaginatedResult } from '../../types/paginated.type';
import { ClientEntity } from '../../entities';

export class GetClientsUseCase {
  constructor(private readonly clientRepository: ClientRepository) {}

  execute(pagination: PaginationDto, filters: FilterClientsDto): Promise<PaginatedResult<ClientEntity>> {
    return this.clientRepository.findAll(pagination, filters);
  }
}
