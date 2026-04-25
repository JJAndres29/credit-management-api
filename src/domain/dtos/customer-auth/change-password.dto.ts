import { regularExps } from '../../../config/regular-exp';

export class ChangePasswordDto {
  private constructor(
    public readonly currentPassword: string,
    public readonly newPassword: string,
  ) {}

  static create(object: Record<string, unknown>): [string?, ChangePasswordDto?] {
    const { currentPassword, newPassword } = object;

    if (!currentPassword || typeof currentPassword !== 'string') return ['currentPassword is required'];
    if (!newPassword || typeof newPassword !== 'string') return ['newPassword is required'];
    if (!regularExps.strongPassword.test(newPassword as string)) {
      return ['New password must be at least 8 characters with uppercase, lowercase, number and special character'];
    }
    if (currentPassword === newPassword) {
      return ['New password must be different from current password'];
    }

    return [undefined, new ChangePasswordDto(currentPassword as string, newPassword as string)];
  }
}
