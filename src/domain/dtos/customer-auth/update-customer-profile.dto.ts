import { regularExps } from '../../../config/regular-exp';

export class UpdateCustomerProfileDto {
  private constructor(
    public readonly name?: string,
    public readonly email?: string,
    public readonly phone?: string,
    public readonly address?: string | null,
  ) {}

  static create(object: Record<string, unknown>): [string?, UpdateCustomerProfileDto?] {
    const { name, email, phone, address } = object;

    if (name !== undefined && (typeof name !== 'string' || name.trim().length < 2)) {
      return ['Name must be at least 2 characters'];
    }
    if (email !== undefined) {
      if (typeof email !== 'string') return ['Invalid email format'];
      if (!regularExps.email.test(email)) return ['Invalid email format'];
    }
    if (phone !== undefined && (typeof phone !== 'string' || phone.trim().length < 7)) {
      return ['Phone must be at least 7 characters'];
    }
    if (address !== undefined && address !== null && typeof address !== 'string') {
      return ['Address must be a string'];
    }

    if (name === undefined && email === undefined && phone === undefined && address === undefined) {
      return ['At least one field must be provided'];
    }

    return [
      undefined,
      new UpdateCustomerProfileDto(
        name !== undefined ? (name as string).trim() : undefined,
        email !== undefined ? (email as string).toLowerCase().trim() : undefined,
        phone !== undefined ? (phone as string).trim() : undefined,
        address !== undefined ? (address === null ? null : (address as string).trim()) : undefined,
      ),
    ];
  }
}
