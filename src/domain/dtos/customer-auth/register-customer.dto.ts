import { regularExps } from '../../../config/regular-exp';

export class RegisterCustomerDto {
  private constructor(
    public readonly name: string,
    public readonly email: string,
    public readonly password: string,
    public readonly phone: string,
    public readonly mergeCartSessionToken: string | null,
  ) {}

  static create(object: Record<string, unknown>): [string?, RegisterCustomerDto?] {
    const { name, email, password, phone, mergeCartSessionToken } = object;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return ['Name must be at least 2 characters'];
    }
    if (!email || typeof email !== 'string') return ['Email is required'];
    if (!regularExps.email.test(email)) return ['Invalid email format'];
    if (!password || typeof password !== 'string') return ['Password is required'];
    if (!regularExps.strongPassword.test(password)) {
      return ['Password must be at least 8 characters with uppercase, lowercase, number and special character'];
    }
    if (!phone || typeof phone !== 'string' || phone.trim().length < 7) {
      return ['Phone must be at least 7 characters'];
    }

    let mergeTok: string | null = null;
    if (mergeCartSessionToken !== undefined && mergeCartSessionToken !== null) {
      if (typeof mergeCartSessionToken !== 'string') return ['mergeCartSessionToken debe ser texto'];
      const t = mergeCartSessionToken.trim();
      if (t.length > 0 && t.length < 8) return ['mergeCartSessionToken inválido'];
      mergeTok = t.length >= 8 ? t : null;
    }

    return [
      undefined,
      new RegisterCustomerDto(
        name.trim(),
        email.toLowerCase().trim(),
        password,
        phone.trim(),
        mergeTok,
      ),
    ];
  }
}
