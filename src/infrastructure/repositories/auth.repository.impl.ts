import { AuthDatasource } from '../../domain/datasources';
import { AuthRepository } from '../../domain/repositories';
import { UserEntity } from '../../domain/entities';

export class AuthRepositoryImpl implements AuthRepository {
  constructor(private readonly datasource: AuthDatasource) {}

  findByEmail(email: string): Promise<UserEntity | null> {
    return this.datasource.findByEmail(email);
  }

  findById(id: string): Promise<UserEntity | null> {
    return this.datasource.findById(id);
  }
}
