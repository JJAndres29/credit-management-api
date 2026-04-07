import { regularExps } from '../../../config/regular-exp';
import { Role } from '../../entities';


export class UpdateUserDto {

    private constructor(
        public readonly name?: string,
        public readonly email?: string,
        public readonly role?: Role,
    ) {}

    static create(object: Record<string, unknown>): [string?, UpdateUserDto?]{
        const { name, email, role } = object;

        if ( name !== undefined) {
            if (typeof name !== 'string' || name.trim().length < 2)
                return ['El nombre debe tener al menos 2 caracteres'];
        }

        if (email !== undefined) {
            if (typeof email !== 'string' || !regularExps.email.test(email))
                return ['Formato de email inválido'];
        }

        if (role !== undefined) {
            const validRoles: Role[] = [Role.ADMIN, Role.SELLER];
                if (!validRoles.includes(role as Role))
                    return [`Rol inválido. Valores permitidos: ${validRoles.join(', ')}`];
        }

        if (name === undefined && email === undefined && role === undefined)
            return ['Debe enviar al menos un campo para actualizar'];

        return [
            undefined,
            new UpdateUserDto(
            name ? (name as string).trim() : undefined,
            email ? (email as string).toLowerCase().trim() : undefined,
            role as Role | undefined,
        ),
    ];

    }


}
