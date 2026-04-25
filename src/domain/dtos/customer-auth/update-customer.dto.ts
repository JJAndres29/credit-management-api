import { regularExps } from '../../../config/regular-exp';

export class UpdateCustomerDto {
  private constructor(
    public readonly name?: string,
    public readonly email?: string,
    public readonly phone?: string,
    public readonly isActive?: boolean,
  ) {}

  static create(object: Record<string, unknown>): [string?, UpdateCustomerDto?] {
    const { name, email, phone, isActive } = object;

    if (name !== undefined && (typeof name !== 'string' || name.trim().length < 2)) {
      return ['Name must be at least 2 characters'];
    }
    if (email !== undefined) {
      if (typeof email !== 'string') return ['Invalid email format'];
      if (!regularExps.email.test(email as string)) return ['Invalid email format'];
    }
    if (phone !== undefined && (typeof phone !== 'string' || (phone as string).trim().length < 7)) {
      return ['Phone must be at least 7 characters'];
    }
    if (isActive !== undefined && typeof isActive !== 'boolean') {
      return ['isActive must be a boolean'];
    }

    if (name === undefined && email === undefined && phone === undefined && isActive === undefined) {
      return ['At least one field must be provided'];
    }

    return [
      undefined,
      new UpdateCustomerDto(
        name !== undefined ? (name as string).trim() : undefined,
        email !== undefined ? (email as string).toLowerCase().trim() : undefined,
        phone !== undefined ? (phone as string).trim() : undefined,
        isActive as boolean | undefined,
      ),
    ];
  }
}
