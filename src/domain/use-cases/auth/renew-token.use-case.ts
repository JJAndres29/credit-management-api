import { CustomError } from '../../errors';
import { AuthRepository } from '../../repositories';
import { JwtService } from '../../services';

interface RenewTokenResponse {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export class RenewTokenUseCase {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
  ) {}

  async execute(userId: string): Promise<RenewTokenResponse> {
    const user = await this.authRepository.findById(userId);

    if (!user || !user.isActive) {
      throw CustomError.unauthorized('Usuario no encontrado o inactivo');
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
