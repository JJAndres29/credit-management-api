import { UserEntity } from '../../entities';
import { UserRepository } from '../../repositories';
import { CustomError } from '../../errors';

export class ToggleUserStatusUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(id: string, isActive: boolean): Promise<UserEntity> {
    const existing = await this.userRepository.findById(id);
    if (!existing) throw CustomError.notFound(`Usuario con id ${id} no encontrado`);

    if (existing.isActive === isActive) {
      const estado = isActive ? 'activo' : 'inactivo';
      throw CustomError.badRequest(`El usuario ya se encuentra ${estado}`);
    }

    return this.userRepository.toggleStatus(id, isActive);
  }
}
