import { Request, Response } from 'express';
import { CustomError } from '../../domain/errors';
import { CreateUserDto, UpdateUserDto, ChangePasswordDto } from '../../domain/dtos';
import {
  GetUsersUseCase,
  GetUserByIdUseCase,
  CreateUserUseCase,
  UpdateUserUseCase,
  ToggleUserStatusUseCase,
  ChangePasswordUseCase,
} from '../../domain/use-cases/users';

export class UserController {
  constructor(
    private readonly getUsersUseCase: GetUsersUseCase,
    private readonly getUserByIdUseCase: GetUserByIdUseCase,
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly updateUserUseCase: UpdateUserUseCase,
    private readonly toggleUserStatusUseCase: ToggleUserStatusUseCase,
    private readonly changePasswordUseCase: ChangePasswordUseCase,
  ) {}

  getAll = async (_req: Request, res: Response): Promise<void> => {
    try {
      const users = await this.getUsersUseCase.execute();
      res.json(users);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = await this.getUserByIdUseCase.execute(req.params.id);
      res.json(user);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const [error, dto] = CreateUserDto.create(req.body as Record<string, unknown>);

    if (error) {
      res.status(400).json({ error });
      return;
    }

    try {
      const user = await this.createUserUseCase.execute(dto!);
      res.status(201).json(user);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const [error, dto] = UpdateUserDto.create(req.body as Record<string, unknown>);

    if (error) {
      res.status(400).json({ error });
      return;
    }

    try {
      const user = await this.updateUserUseCase.execute(req.params.id, dto!);
      res.json(user);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  toggleStatus = async (req: Request, res: Response): Promise<void> => {
    const { isActive } = req.body as Record<string, unknown>;

    if (typeof isActive !== 'boolean') {
      res.status(400).json({ error: 'El campo isActive debe ser un booleano (true o false)' });
      return;
    }

    try {
      const user = await this.toggleUserStatusUseCase.execute(req.params.id, isActive);
      res.json(user);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  changePassword = async (req: Request, res: Response): Promise<void> => {
    const [error, dto] = ChangePasswordDto.create(req.body as Record<string, unknown>);

    if (error) {
      res.status(400).json({ error });
      return;
    }

    try {
      const result = await this.changePasswordUseCase.execute(req.params.id, dto!);
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
