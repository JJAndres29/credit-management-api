import bcryptjs from 'bcryptjs';
import { UserRepository } from '../../repositories';
import { CreateUserDto } from '../../dtos';
import { CustomError } from '../../errors';

interface UserResponse {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
}

export class CreateUserUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(dto: CreateUserDto): Promise<UserResponse> {
    const existing = await this.userRepository.findByEmail(dto.email);
    if (existing) throw CustomError.conflict(`El email ${dto.email} ya está registrado`);

    const hashedPassword = bcryptjs.hashSync(dto.password, 10);
    const user = await this.userRepository.create(dto, hashedPassword);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }
}