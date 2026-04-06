import { Request, Response } from 'express';
import { CustomError } from '../../domain/errors';
import { LoginDto } from '../../domain/dtos/auth';
import { LoginUseCase, RenewTokenUseCase } from '../../domain/use-cases/auth';
import { UserEntity } from '../../domain/entities';

type AuthRequest = Request & { user?: UserEntity };

export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly renewTokenUseCase: RenewTokenUseCase,
  ) {}

  login = async (req: Request, res: Response): Promise<void> => {
    const [error, loginDto] = LoginDto.create(req.body as Record<string, unknown>);

    if (error) {
      res.status(400).json({ error });
      return;
    }

    try {
      const result = await this.loginUseCase.execute(loginDto!);
      res.json(result);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  renewToken = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const result = await this.renewTokenUseCase.execute(req.user!.id);
      res.json(result);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  private handleError(error: unknown, res: Response): void {
    if (error instanceof CustomError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}
