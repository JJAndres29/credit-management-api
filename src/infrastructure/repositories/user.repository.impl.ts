import { UserDatasource } from '../../domain/datasources';
import { UserRepository } from '../../domain/repositories';
import { UserEntity } from '../../domain/entities';
import { CreateUserDto, UpdateUserDto } from '../../domain/dtos';

export class UserRepositoryImpl implements UserRepository {
  constructor(private readonly datasource: UserDatasource) {}

  findAll(): Promise<UserEntity[]> {
    return this.datasource.findAll();
  }

  findById(id: string): Promise<UserEntity | null> {
    return this.datasource.findById(id);
  }

  findByEmail(email: string): Promise<UserEntity | null> {
    return this.datasource.findByEmail(email);
  }

  create(dto: CreateUserDto, hashedPassword: string): Promise<UserEntity> {
    return this.datasource.create(dto, hashedPassword);
  }

  update(id: string, dto: UpdateUserDto): Promise<UserEntity> {
    return this.datasource.update(id, dto);
  }

  toggleStatus(id: string, isActive: boolean): Promise<UserEntity> {
    return this.datasource.toggleStatus(id, isActive);
  }

  changePassword(id: string, hashedPassword: string): Promise<UserEntity> {
    return this.datasource.changePassword(id, hashedPassword);
  }
}
