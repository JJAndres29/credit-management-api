import { Request, Response } from 'express';
import { CustomError } from '../../domain/errors';
import { UserEntity } from '../../domain/entities';
import { CreateSaleDto, FilterSalesDto } from '../../domain/dtos/sales';
import { PaginationDto } from '../../domain/dtos/shared';
import { CreateSaleUseCase } from '../../domain/use-cases/sales/create-sale.use-case';
import { GetSalesUseCase } from '../../domain/use-cases/sales/get-sales.use-case';
import { GetSaleByIdUseCase } from '../../domain/use-cases/sales/get-sale-by-id.use-case';
import { GetSalesByClientUseCase } from '../../domain/use-cases/sales/get-sales-by-client.use-case';

export class SaleController {
  constructor(
    private readonly createSaleUseCase: CreateSaleUseCase,
    private readonly getSalesUseCase: GetSalesUseCase,
    private readonly getSaleByIdUseCase: GetSaleByIdUseCase,
    private readonly getSalesByClientUseCase: GetSalesByClientUseCase,
  ) {}

  getAll = async (req: Request, res: Response): Promise<void> => {
    const [pError, pagination] = PaginationDto.create(req.query as Record<string, unknown>);
    if (pError) { res.status(400).json({ error: pError }); return; }

    const [fError, filters] = FilterSalesDto.create(req.query as Record<string, unknown>);
    if (fError) { res.status(400).json({ error: fError }); return; }

    try {
      const result = await this.getSalesUseCase.execute(pagination!, filters!);
      res.json(result);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    try {
      const sale = await this.getSaleByIdUseCase.execute(req.params.id);
      res.json(sale);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  getByClient = async (req: Request, res: Response): Promise<void> => {
    try {
      const sales = await this.getSalesByClientUseCase.execute(req.params.clientId);
      res.json(sales);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const [error, dto] = CreateSaleDto.create(req.body as Record<string, unknown>);

    if (error) {
      res.status(400).json({ error });
      return;
    }

    const user = (req as Request & { user: UserEntity }).user;
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';

    try {
      const { sale, whatsappPayload } = await this.createSaleUseCase.execute(dto!, user.id, ip);
      res.status(201).json({ ...sale, whatsappPayload });
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
