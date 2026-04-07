import { UserEntity } from '../../entities';
import { UserRepository } from '../../repositories';
import { CustomError } from '../../errors';

export class GetUserByIdUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(id: string): Promise<UserEntity> {
    const user = await this.userRepository.findById(id);
    if (!user) throw CustomError.notFound(`Usuario con id ${id} no encontrado`);
    return user;
  }
}