import { ClientEntity } from '../entities';
import { CreateClientDto, UpdateClientDto } from '../dtos/clients';

export interface ClientRepository {
  findAll(): Promise<ClientEntity[]>;
  findById(id: string): Promise<ClientEntity | null>;
  findByEmail(email: string): Promise<ClientEntity | null>;
  create(dto: CreateClientDto): Promise<ClientEntity>;
  update(id: string, dto: UpdateClientDto): Promise<ClientEntity>;
  delete(id: string): Promise<ClientEntity>;
}
