export class LoginCustomerDto {
  private constructor(
    public readonly email: string,
    public readonly password: string,
    /** P3 — persisted anonymous cart merged server-side after successful login */
    public readonly mergeCartSessionToken: string | null,
  ) {}

  static create(object: Record<string, unknown>): [string?, LoginCustomerDto?] {
    const { email, password, mergeCartSessionToken } = object;

    if (!email || typeof email !== 'string') return ['Email is required'];
    if (!email.includes('@')) return ['Invalid email format'];
    if (!password || typeof password !== 'string') return ['Password is required'];

    let mergeTok: string | null = null;
    if (mergeCartSessionToken !== undefined && mergeCartSessionToken !== null) {
      if (typeof mergeCartSessionToken !== 'string') return ['mergeCartSessionToken debe ser texto'];
      const t = mergeCartSessionToken.trim();
      if (t.length > 0 && t.length < 8) return ['mergeCartSessionToken inválido'];
      mergeTok = t.length >= 8 ? t : null;
    }

    return [undefined, new LoginCustomerDto(email.toLowerCase().trim(), password, mergeTok)];
  }
}
