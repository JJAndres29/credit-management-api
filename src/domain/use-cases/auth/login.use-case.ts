import bcryptjs from 'bcryptjs';
import { LoginDto } from '../../dtos/auth';
import { CustomError } from '../../errors';
import { AuthRepository } from '../../repositories';
import { JwtService } from '../../services';

interface LoginResponse {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export class LoginUseCase {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
  ) {}

  async execute(loginDto: LoginDto): Promise<LoginResponse> {
    const user = await this.authRepository.findByEmail(loginDto.email);

    // Mensaje genérico siempre — nunca revelar si el email existe
    if (!user || !user.isActive) {
      throw CustomError.unauthorized('Credenciales inválidas');
    }

    const passwordMatch = bcryptjs.compareSync(loginDto.password, user.password);
    if (!passwordMatch) {
      throw CustomError.unauthorized('Credenciales inválidas');
    }

    const token = await this.jwtService.generateToken({
      id: user.id,
      role: user.role,
    });

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }
}
