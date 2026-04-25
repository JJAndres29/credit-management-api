import { regularExps } from '../../../config/regular-exp';

export class ForgotPasswordDto {
  private constructor(public readonly email: string) {}

  static create(object: Record<string, unknown>): [string?, ForgotPasswordDto?] {
    const { email } = object;
    if (!email || typeof email !== 'string') return ['Email is required'];
    if (!regularExps.email.test(email as string)) return ['Invalid email format'];
    return [undefined, new ForgotPasswordDto((email as string).toLowerCase().trim())];
  }
}
