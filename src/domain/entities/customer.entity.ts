import { CustomError } from '../errors';

export class CustomerEntity {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly email: string,
    public readonly password: string,
    public readonly phone: string,
    public readonly emailVerifiedAt: Date | null,
    public readonly isActive: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      phone: this.phone,
      emailVerifiedAt: this.emailVerifiedAt,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static fromObject(object: Record<string, unknown>): CustomerEntity {
    const { id, name, email, password, phone, emailVerifiedAt, isActive, createdAt, updatedAt } = object;

    if (!id) throw CustomError.internalServer('Customer id is required');
    if (!name) throw CustomError.internalServer('Customer name is required');
    if (!email) throw CustomError.internalServer('Customer email is required');
    if (!password) throw CustomError.internalServer('Customer password is required');
    if (!phone) throw CustomError.internalServer('Customer phone is required');

    return new CustomerEntity(
      id as string,
      name as string,
      email as string,
      password as string,
      phone as string,
      (emailVerifiedAt as Date | null) ?? null,
      (isActive as boolean) ?? true,
      (createdAt as Date) ?? new Date(),
      (updatedAt as Date) ?? new Date(),
    );
  }
}
