import { UserEntity } from '../../entities';
import { UserRepository } from '../../repositories';
import { UpdateUserDto } from '../../dtos';
import { CustomError } from '../../errors';

export class UpdateUserUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(id: string, dto: UpdateUserDto): Promise<UserEntity> {
    const existing = await this.userRepository.findById(id);
    if (!existing) throw CustomError.notFound(`Usuario con id ${id} no encontrado`);

    if (dto.email && dto.email !== existing.email) {
      const emailTaken = await this.userRepository.findByEmail(dto.email);
      if (emailTaken) throw CustomError.conflict(`El email ${dto.email} ya está registrado`);
    }

    return this.userRepository.update(id, dto);
  }
}
