import { CustomError } from '../errors';

export enum Role {
  ADMIN = 'ADMIN',
  SELLER = 'SELLER',
}

export class UserEntity {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly email: string,
    public readonly password: string,
    public readonly role: Role,
    public readonly isActive: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      role: this.role,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static fromObject(object: Record<string, unknown>): UserEntity {
    const { id, name, email, password, role, isActive, createdAt, updatedAt } = object;

    if (!id) throw CustomError.internalServer('User id is required');
    if (!name) throw CustomError.internalServer('User name is required');
    if (!email) throw CustomError.internalServer('User email is required');
    if (!password) throw CustomError.internalServer('User password is required');
    if (!role) throw CustomError.internalServer('User role is required');

    return new UserEntity(
      id as string,
      name as string,
      email as string,
      password as string,
      role as Role,
      (isActive as boolean) ?? true,
      (createdAt as Date) ?? new Date(),
      (updatedAt as Date) ?? new Date(),
    );
  }
}
