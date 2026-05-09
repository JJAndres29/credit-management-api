import { Request, Response } from 'express';
import { CustomError } from '../../domain/errors';
import { CustomerEntity } from '../../domain/entities';
import { CreateOnlineOrderDto, FilterOnlineOrdersDto, UpdateOnlineOrderStatusDto } from '../../domain/dtos/online-orders';
import { PaginationDto } from '../../domain/dtos/shared';
import { CreateOnlineOrderUseCase } from '../../domain/use-cases/online-orders/create-online-order.use-case';
import { GetOnlineOrderByIdUseCase } from '../../domain/use-cases/online-orders/get-online-order-by-id.use-case';
import { GetOnlineOrdersUseCase } from '../../domain/use-cases/online-orders/get-online-orders.use-case';
import { UpdateOnlineOrderStatusUseCase } from '../../domain/use-cases/online-orders/update-online-order-status.use-case';

type MaybeCustomerRequest = Request & { customer?: CustomerEntity };

export class OnlineOrderController {
  constructor(
    private readonly createOnlineOrderUseCase: CreateOnlineOrderUseCase,
    private readonly getOnlineOrderByIdUseCase: GetOnlineOrderByIdUseCase,
    private readonly getOnlineOrdersUseCase: GetOnlineOrdersUseCase,
    private readonly updateOnlineOrderStatusUseCase: UpdateOnlineOrderStatusUseCase,
  ) {}

  create = async (req: MaybeCustomerRequest, res: Response): Promise<void> => {
    const [error, dto] = CreateOnlineOrderDto.create(req.body as Record<string, unknown>);
    if (error) { res.status(400).json({ error }); return; }

    const customerId = req.customer?.id ?? null;

    // Guest order requires guest fields in body
    if (!customerId && !dto!.guestEmail) {
      res.status(400).json({ error: 'guestEmail es requerido para órdenes de invitado' });
      return;
    }

    try {
      const result = await this.createOnlineOrderUseCase.execute(dto!, customerId, {
        ipAddress: typeof req.ip === 'string' ? req.ip : null,
        userAgent: req.get('user-agent') ?? null,
      });
      res.status(201).json(result);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  getById = async (req: MaybeCustomerRequest, res: Response): Promise<void> => {
    const customerId = req.customer?.id ?? null;
    const email = (req.query['email'] as string | undefined) ?? null;

    try {
      const order = await this.getOnlineOrderByIdUseCase.execute(req.params.id, customerId, email);
      res.json(order);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  getAll = async (req: Request, res: Response): Promise<void> => {
    const [pError, pagination] = PaginationDto.create(req.query as Record<string, unknown>);
    if (pError) { res.status(400).json({ error: pError }); return; }

    const [fError, filters] = FilterOnlineOrdersDto.create(req.query as Record<string, unknown>);
    if (fError) { res.status(400).json({ error: fError }); return; }

    try {
      const result = await this.getOnlineOrdersUseCase.execute(pagination!, filters!);
      res.json(result);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  updateStatus = async (req: Request, res: Response): Promise<void> => {
    const [error, dto] = UpdateOnlineOrderStatusDto.create(req.body as Record<string, unknown>);
    if (error) { res.status(400).json({ error }); return; }

    try {
      const order = await this.updateOnlineOrderStatusUseCase.execute(req.params.id, dto!);
      res.json(order);
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
