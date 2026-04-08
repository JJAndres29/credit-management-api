import { Request, Response } from 'express';
import { CustomError } from '../../domain/errors';
import { CreateSaleDto } from '../../domain/dtos/sales';
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

  getAll = async (_req: Request, res: Response): Promise<void> => {
    try {
      const sales = await this.getSalesUseCase.execute();
      res.json(sales);
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

    try {
      const sale = await this.createSaleUseCase.execute(dto!);
      res.status(201).json(sale);
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
