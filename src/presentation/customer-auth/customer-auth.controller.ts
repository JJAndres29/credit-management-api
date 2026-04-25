import { Request, Response } from 'express';
import { CustomError } from '../../domain/errors';
import { RegisterCustomerDto, LoginCustomerDto } from '../../domain/dtos/customer-auth';
import {
  RegisterCustomerUseCase,
  LoginCustomerUseCase,
  RenewCustomerTokenUseCase,
} from '../../domain/use-cases/customer-auth';
import { CustomerEntity } from '../../domain/entities';

type CustomerRequest = Request & { customer?: CustomerEntity };

export class CustomerAuthController {
  constructor(
    private readonly registerUseCase: RegisterCustomerUseCase,
    private readonly loginUseCase: LoginCustomerUseCase,
    private readonly renewTokenUseCase: RenewCustomerTokenUseCase,
  ) {}

  register = async (req: Request, res: Response): Promise<void> => {
    const [error, dto] = RegisterCustomerDto.create(req.body as Record<string, unknown>);
    if (error) {
      res.status(400).json({ error });
      return;
    }
    try {
      const result = await this.registerUseCase.execute(dto!);
      res.status(201).json(result);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const [error, dto] = LoginCustomerDto.create(req.body as Record<string, unknown>);
    if (error) {
      res.status(400).json({ error });
      return;
    }
    try {
      const result = await this.loginUseCase.execute(dto!);
      res.json(result);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  renewToken = async (req: CustomerRequest, res: Response): Promise<void> => {
    try {
      const result = await this.renewTokenUseCase.execute(req.customer!.id);
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
