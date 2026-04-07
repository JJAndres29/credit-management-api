import bcryptjs from 'bcryptjs';
import { UserRepository } from '../../repositories';
import { ChangePasswordDto } from '../../dtos';
import { CustomError } from '../../errors';

export class ChangePasswordUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(id: string, dto: ChangePasswordDto): Promise<{ message: string }> {
    const user = await this.userRepository.findById(id);
    if (!user) throw CustomError.notFound(`Usuario con id ${id} no encontrado`);

    const passwordMatch = bcryptjs.compareSync(dto.currentPassword, user.password);
    if (!passwordMatch) throw CustomError.unauthorized('La contraseña actual es incorrecta');

    const hashedPassword = bcryptjs.hashSync(dto.newPassword, 10);
    await this.userRepository.changePassword(id, hashedPassword);

    return { message: 'Contraseña actualizada correctamente' };
  }
}
