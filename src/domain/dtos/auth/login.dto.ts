export class LoginDto {
  private constructor(
    public readonly email: string,
    public readonly password: string,
  ) {}

  static create(object: Record<string, unknown>): [string?, LoginDto?] {
    const { email, password } = object;

    if (!email) return ['Email is required'];
    if (typeof email !== 'string' || !email.includes('@')) return ['Invalid email format'];
    if (!password) return ['Password is required'];
    if (typeof password !== 'string' || password.length < 6) return ['Password must be at least 6 characters'];

    return [undefined, new LoginDto(email.toLowerCase().trim(), password)];
  }
}
