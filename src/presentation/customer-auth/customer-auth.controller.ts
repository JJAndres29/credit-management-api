import { Request, Response } from 'express';
import { CustomError } from '../../domain/errors';
import {
  GoogleAuthDto,
  ClaimClientDto,
  UpdateCustomerDto,
  FilterCustomersDto,
  RegisterCustomerDto,
  LoginCustomerDto,
  ChangePasswordDto,
  ForgotPasswordDto,
} from '../../domain/dtos/customer-auth';
import { PaginationDto } from '../../domain/dtos/shared';
import {
  GoogleAuthUseCase,
  RenewCustomerTokenUseCase,
  ClaimClientUseCase,
  GetCustomerProfileUseCase,
  GetCustomersUseCase,
  UpdateCustomerUseCase,
  RegisterCustomerUseCase,
  LoginCustomerUseCase,
  ChangeCustomerPasswordUseCase,
  ForgotCustomerPasswordUseCase,
  ResetCustomerPasswordUseCase,
} from '../../domain/use-cases/customer-auth';
import { CustomerEntity } from '../../domain/entities';

type CustomerRequest = Request & { customer?: CustomerEntity };

export class CustomerAuthController {
  constructor(
    private readonly googleAuthUseCase: GoogleAuthUseCase,
    private readonly renewTokenUseCase: RenewCustomerTokenUseCase,
    private readonly claimClientUseCase: ClaimClientUseCase,
    private readonly getProfileUseCase: GetCustomerProfileUseCase,
    private readonly getCustomersUseCase: GetCustomersUseCase,
    private readonly updateCustomerUseCase: UpdateCustomerUseCase,
    private readonly registerCustomerUseCase: RegisterCustomerUseCase,
    private readonly loginCustomerUseCase: LoginCustomerUseCase,
    private readonly changeCustomerPasswordUseCase: ChangeCustomerPasswordUseCase,
    private readonly forgotCustomerPasswordUseCase: ForgotCustomerPasswordUseCase,
    private readonly resetCustomerPasswordUseCase: ResetCustomerPasswordUseCase,
  ) {}

  // ─── Public ────────────────────────────────────────────────────────────────

  register = async (req: Request, res: Response): Promise<void> => {
    const [error, dto] = RegisterCustomerDto.create(req.body as Record<string, unknown>);
    if (error) { res.status(400).json({ error }); return; }
    try {
      res.status(201).json(await this.registerCustomerUseCase.execute(dto!));
    } catch (err) { this.handleError(err, res); }
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const [error, dto] = LoginCustomerDto.create(req.body as Record<string, unknown>);
    if (error) { res.status(400).json({ error }); return; }
    try {
      res.json(await this.loginCustomerUseCase.execute(dto!));
    } catch (err) { this.handleError(err, res); }
  };

  googleAuth = async (req: Request, res: Response): Promise<void> => {
    const [error, dto] = GoogleAuthDto.create(req.body as Record<string, unknown>);
    if (error) { res.status(400).json({ error }); return; }
    try {
      res.json(await this.googleAuthUseCase.execute(dto!));
    } catch (err) { this.handleError(err, res); }
  };

  forgotPassword = async (req: Request, res: Response): Promise<void> => {
    const [error, dto] = ForgotPasswordDto.create(req.body as Record<string, unknown>);
    if (error) { res.status(400).json({ error }); return; }
    try {
      await this.forgotCustomerPasswordUseCase.execute(dto!.email);
      res.json({ message: 'Si el correo existe, se enviarán instrucciones para recuperar la contraseña' });
    } catch (err) { this.handleError(err, res); }
  };

  // ─── Customer JWT ──────────────────────────────────────────────────────────

  renewToken = async (req: CustomerRequest, res: Response): Promise<void> => {
    try {
      res.json(await this.renewTokenUseCase.execute(req.customer!.id));
    } catch (err) { this.handleError(err, res); }
  };

  claimClient = async (req: CustomerRequest, res: Response): Promise<void> => {
    const [error, dto] = ClaimClientDto.create(req.body as Record<string, unknown>);
    if (error) { res.status(400).json({ error }); return; }
    try {
      res.json(await this.claimClientUseCase.execute(req.customer!.id, dto!));
    } catch (err) { this.handleError(err, res); }
  };

  getProfile = async (req: CustomerRequest, res: Response): Promise<void> => {
    try {
      res.json(await this.getProfileUseCase.execute(req.customer!.id));
    } catch (err) { this.handleError(err, res); }
  };

  changePassword = async (req: CustomerRequest, res: Response): Promise<void> => {
    const [error, dto] = ChangePasswordDto.create(req.body as Record<string, unknown>);
    if (error) { res.status(400).json({ error }); return; }
    try {
      await this.changeCustomerPasswordUseCase.execute(req.customer!.id, dto!);
      res.json({ message: 'Contraseña actualizada correctamente' });
    } catch (err) { this.handleError(err, res); }
  };

  // ─── Admin (Staff JWT + ADMIN role) ────────────────────────────────────────

  getCustomers = async (req: Request, res: Response): Promise<void> => {
    const [paginationError, pagination] = PaginationDto.create(req.query as Record<string, unknown>);
    if (paginationError) { res.status(400).json({ error: paginationError }); return; }
    const [, filters] = FilterCustomersDto.create(req.query as Record<string, unknown>);
    try {
      res.json(await this.getCustomersUseCase.execute(pagination!, filters!));
    } catch (err) { this.handleError(err, res); }
  };

  updateCustomer = async (req: Request, res: Response): Promise<void> => {
    const [error, dto] = UpdateCustomerDto.create(req.body as Record<string, unknown>);
    if (error) { res.status(400).json({ error }); return; }
    try {
      res.json(await this.updateCustomerUseCase.execute(req.params.id, dto!));
    } catch (err) { this.handleError(err, res); }
  };

  resetPassword = async (req: Request, res: Response): Promise<void> => {
    try {
      await this.resetCustomerPasswordUseCase.execute(req.params.id);
      res.json({ message: 'Contraseña temporal generada y enviada al cliente' });
    } catch (err) { this.handleError(err, res); }
  };

  // ─── Error handler ─────────────────────────────────────────────────────────

  private handleError(error: unknown, res: Response): void {
    if (error instanceof CustomError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}
