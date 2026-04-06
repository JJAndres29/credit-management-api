import { regularExps } from '../../../config/regular-exp';
import { Role } from '../../entities';

export class CreateUserDto {
  private constructor(
    public readonly name: string,
    public readonly email: string,
    public readonly password: string,
    public readonly role: Role,
  ) {}

  static create(object: Record<string, unknown>): [string?, CreateUserDto?] {
    const { name, email, password, role } = object;

    if (!name) return ['El nombre es requerido'];
    if (typeof name !== 'string' || name.trim().length < 2)
      return ['El nombre debe tener al menos 2 caracteres'];

    if (!email) return ['El email es requerido'];
    if (typeof email !== 'string' || !regularExps.email.test(email))
      return ['Formato de email inválido'];

    if (!password) return ['La contraseña es requerida'];
    if (typeof password !== 'string') return ['Contraseña inválida'];
    if (!regularExps.strongPassword.test(password))
      return [
        'La contraseña debe tener mínimo 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial',
      ];

    const validRoles: Role[] = [Role.ADMIN, Role.SELLER];
    const assignedRole = role ?? Role.SELLER;
    if (!validRoles.includes(assignedRole as Role))
      return [`Rol inválido. Valores permitidos: ${validRoles.join(', ')}`];

    return [
      undefined,
      new CreateUserDto(
        name.trim(),
        email.toLowerCase().trim(),
        password,
        assignedRole as Role,
      ),
    ];
  }
}
