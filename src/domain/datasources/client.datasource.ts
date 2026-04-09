import { ClientEntity } from '../entities';
import { CreateClientDto, UpdateClientDto, FilterClientsDto } from '../dtos/clients';
import { PaginationDto } from '../dtos/shared';
import { PaginatedResult } from '../types/paginated.type';

export interface ClientDatasource {
  findAll(pagination: PaginationDto, filters: FilterClientsDto): Promise<PaginatedResult<ClientEntity>>;
  findById(id: string): Promise<ClientEntity | null>;
  findByEmail(email: string): Promise<ClientEntity | null>;
  create(dto: CreateClientDto): Promise<ClientEntity>;
  update(id: string, dto: UpdateClientDto): Promise<ClientEntity>;
  delete(id: string): Promise<ClientEntity>;
}
