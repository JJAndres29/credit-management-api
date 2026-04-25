import { ClientDatasource } from '../../domain/datasources';
import { ClientRepository } from '../../domain/repositories';
import { ClientEntity } from '../../domain/entities';
import { CreateClientDto, UpdateClientDto, FilterClientsDto } from '../../domain/dtos/clients';
import { PaginationDto } from '../../domain/dtos/shared';
import { PaginatedResult } from '../../domain/types/paginated.type';

export class ClientRepositoryImpl implements ClientRepository {
  constructor(private readonly datasource: ClientDatasource) {}

  findAll(pagination: PaginationDto, filters: FilterClientsDto): Promise<PaginatedResult<ClientEntity>> {
    return this.datasource.findAll(pagination, filters);
  }

  findById(id: string): Promise<ClientEntity | null> {
    return this.datasource.findById(id);
  }

  findByEmail(email: string): Promise<ClientEntity | null> {
    return this.datasource.findByEmail(email);
  }

  findByDocument(documentType: string, documentNumber: string): Promise<ClientEntity | null> {
    return this.datasource.findByDocument(documentType, documentNumber);
  }

  create(dto: CreateClientDto): Promise<ClientEntity> {
    return this.datasource.create(dto);
  }

  update(id: string, dto: UpdateClientDto): Promise<ClientEntity> {
    return this.datasource.update(id, dto);
  }

  delete(id: string): Promise<ClientEntity> {
    return this.datasource.delete(id);
  }
}
