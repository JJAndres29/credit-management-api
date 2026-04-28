import { CustomError } from '../errors';

export class CustomerEntity {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly email: string,
    public readonly phone: string,
    public readonly password: string | null,
    public readonly googleId: string | null,
    public readonly isActive: boolean,
    public readonly clientId: string | null,
    public readonly mustChangePassword: boolean,
    public readonly address: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      phone: this.phone,
      googleId: this.googleId,
      isActive: this.isActive,
      clientId: this.clientId,
      mustChangePassword: this.mustChangePassword,
      address: this.address,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static fromObject(object: Record<string, unknown>): CustomerEntity {
    const { id, name, email, phone, password, googleId, isActive, clientId, mustChangePassword, address, createdAt, updatedAt } = object;

    if (!id) throw CustomError.internalServer('Customer id is required');
    if (!name) throw CustomError.internalServer('Customer name is required');
    if (!email) throw CustomError.internalServer('Customer email is required');
    if (phone === undefined || phone === null) throw CustomError.internalServer('Customer phone is required');

    return new CustomerEntity(
      id as string,
      name as string,
      email as string,
      phone as string,
      (password as string | null) ?? null,
      (googleId as string | null) ?? null,
      (isActive as boolean) ?? true,
      (clientId as string | null) ?? null,
      (mustChangePassword as boolean) ?? false,
      (address as string | null) ?? null,
      (createdAt as Date) ?? new Date(),
      (updatedAt as Date) ?? new Date(),
    );
  }
}
