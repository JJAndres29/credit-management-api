import { ClientDatasource } from '../../domain/datasources';
import { ClientRepository } from '../../domain/repositories';
import { ClientEntity } from '../../domain/entities';
import { CreateClientDto, UpdateClientDto } from '../../domain/dtos/clients';

export class ClientRepositoryImpl implements ClientRepository {
  constructor(private readonly datasource: ClientDatasource) {}

  findAll(): Promise<ClientEntity[]> {
    return this.datasource.findAll();
  }

  findById(id: string): Promise<ClientEntity | null> {
    return this.datasource.findById(id);
  }

  findByEmail(email: string): Promise<ClientEntity | null> {
    return this.datasource.findByEmail(email);
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
