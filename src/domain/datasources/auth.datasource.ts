import { UserEntity } from '../entities';

export interface AuthDatasource {
  findByEmail(email: string): Promise<UserEntity | null>;
  findById(id: string): Promise<UserEntity | null>;
}
