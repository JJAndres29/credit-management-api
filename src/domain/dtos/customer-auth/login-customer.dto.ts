export class LoginCustomerDto {
  private constructor(
    public readonly email: string,
    public readonly password: string,
  ) {}

  static create(object: Record<string, unknown>): [string?, LoginCustomerDto?] {
    const { email, password } = object;

    if (!email || typeof email !== 'string') return ['Email is required'];
    if (!email.includes('@')) return ['Invalid email format'];
    if (!password || typeof password !== 'string') return ['Password is required'];

    return [undefined, new LoginCustomerDto(email.toLowerCase().trim(), password)];
  }
}
