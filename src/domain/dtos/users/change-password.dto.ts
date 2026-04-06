import { regularExps } from '../../../config/regular-exp';

export class ChangePasswordDto {
  private constructor(
    public readonly currentPassword: string,
    public readonly newPassword: string,
  ) {}

  static create(object: Record<string, unknown>): [string?, ChangePasswordDto?] {
    const { currentPassword, newPassword } = object;

    if (!currentPassword) return ['La contraseña actual es requerida'];
    if (typeof currentPassword !== 'string') return ['Contraseña actual inválida'];

    if (!newPassword) return ['La nueva contraseña es requerida'];
    if (typeof newPassword !== 'string') return ['Nueva contraseña inválida'];

    if (!regularExps.strongPassword.test(newPassword))
      return [
        'La nueva contraseña debe tener mínimo 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial',
      ];

    if (currentPassword === newPassword)
      return ['La nueva contraseña debe ser diferente a la actual'];

    return [undefined, new ChangePasswordDto(currentPassword, newPassword)];
  }
}
