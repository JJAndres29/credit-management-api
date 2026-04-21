import { Request, Response } from 'express';
import { CustomError } from '../../domain/errors';
import { UserEntity } from '../../domain/entities';
import { CreatePaymentDto, FilterPaymentsDto, UpdatePaymentDto } from '../../domain/dtos/payments';
import { PaginationDto } from '../../domain/dtos/shared';
import { CreatePaymentUseCase } from '../../domain/use-cases/payments/create-payment.use-case';
import { GetPaymentsUseCase } from '../../domain/use-cases/payments/get-payments.use-case';
import { GetPaymentByIdUseCase } from '../../domain/use-cases/payments/get-payment-by-id.use-case';
import { GetPaymentsByClientUseCase } from '../../domain/use-cases/payments/get-payments-by-client.use-case';
import { GetPaymentsBySaleUseCase } from '../../domain/use-cases/payments/get-payments-by-sale.use-case';
import { UpdatePaymentUseCase } from '../../domain/use-cases/payments/update-payment.use-case';
import { DeletePaymentUseCase } from '../../domain/use-cases/payments/delete-payment.use-case';

export class PaymentController {
  constructor(
    private readonly createPaymentUseCase: CreatePaymentUseCase,
    private readonly getPaymentsUseCase: GetPaymentsUseCase,
    private readonly getPaymentByIdUseCase: GetPaymentByIdUseCase,
    private readonly getPaymentsByClientUseCase: GetPaymentsByClientUseCase,
    private readonly getPaymentsBySaleUseCase: GetPaymentsBySaleUseCase,
    private readonly updatePaymentUseCase: UpdatePaymentUseCase,
    private readonly deletePaymentUseCase: DeletePaymentUseCase,
  ) {}

  getAll = async (req: Request, res: Response): Promise<void> => {
    const [pError, pagination] = PaginationDto.create(req.query as Record<string, unknown>);
    if (pError) { res.status(400).json({ error: pError }); return; }

    const [fError, filters] = FilterPaymentsDto.create(req.query as Record<string, unknown>);
    if (fError) { res.status(400).json({ error: fError }); return; }

    try {
      const result = await this.getPaymentsUseCase.execute(pagination!, filters!);
      res.json(result);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    try {
      const payment = await this.getPaymentByIdUseCase.execute(req.params.id);
      res.json(payment);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  getByClient = async (req: Request, res: Response): Promise<void> => {
    try {
      const payments = await this.getPaymentsByClientUseCase.execute(req.params.clientId);
      res.json(payments);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  getBySale = async (req: Request, res: Response): Promise<void> => {
    try {
      const payments = await this.getPaymentsBySaleUseCase.execute(req.params.saleId);
      res.json(payments);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const [error, dto] = CreatePaymentDto.create(req.body as Record<string, unknown>);

    if (error) {
      res.status(400).json({ error });
      return;
    }

    const user = (req as Request & { user: UserEntity }).user;
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';

    try {
      const { payment, whatsappPayload } = await this.createPaymentUseCase.execute(dto!, user.id, ip);
      res.status(201).json({ ...payment, whatsappPayload });
    } catch (err) {
      this.handleError(err, res);
    }
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const [error, dto] = UpdatePaymentDto.create(req.body as Record<string, unknown>);

    if (error) {
      res.status(400).json({ error });
      return;
    }

    const user = (req as Request & { user: UserEntity }).user;
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';

    try {
      const payment = await this.updatePaymentUseCase.execute(req.params.id, dto!, user.id, ip);
      res.json(payment);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    const user = (req as Request & { user: UserEntity }).user;
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';

    try {
      const payment = await this.deletePaymentUseCase.execute(req.params.id, user.id, ip);
      res.json(payment);
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
