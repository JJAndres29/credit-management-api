import { UserEntity } from '../entities';
import { CreateUserDto, UpdateUserDto } from '../dtos';

export interface UserRepository {
  findAll(): Promise<UserEntity[]>;
  findById(id: string): Promise<UserEntity | null>;
  findByEmail(email: string): Promise<UserEntity | null>;
  create(dto: CreateUserDto, hashedPassword: string): Promise<UserEntity>;
  update(id: string, dto: UpdateUserDto): Promise<UserEntity>;
  toggleStatus(id: string, isActive: boolean): Promise<UserEntity>;
  changePassword(id: string, hashedPassword: string): Promise<UserEntity>;
}