import { Request, Response } from 'express';
import { CustomError } from '../../domain/errors';
import { CustomerEntity } from '../../domain/entities';
import { AddCartItemDto } from '../../domain/dtos/cart/add-cart-item.dto';
import { UpdateCartItemDto } from '../../domain/dtos/cart/update-cart-item.dto';
import {
  GetCartUseCase,
  AddCartItemUseCase,
  UpdateCartItemUseCase,
  RemoveCartItemUseCase,
} from '../../domain/use-cases/cart';

type CartRequest = Request & { customer?: CustomerEntity };

function sessionHeader(req: Request): string | null {
  const raw = req.get('x-cart-session');
  return raw?.trim() && raw.trim().length >= 8 ? raw.trim() : null;
}

export class CartController {
  constructor(
    private readonly getCartUseCase: GetCartUseCase,
    private readonly addCartItemUseCase: AddCartItemUseCase,
    private readonly updateCartItemUseCase: UpdateCartItemUseCase,
    private readonly removeCartItemUseCase: RemoveCartItemUseCase,
  ) {}

  get = async (req: CartRequest, res: Response): Promise<void> => {
    try {
      const cart = await this.getCartUseCase.execute(req.customer?.id ?? null, sessionHeader(req));
      res.json(cart);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  addItem = async (req: CartRequest, res: Response): Promise<void> => {
    const [error, dto] = AddCartItemDto.create(req.body as Record<string, unknown>);
    if (error) { res.status(400).json({ error }); return; }
    try {
      const cart = await this.addCartItemUseCase.execute(
        dto!,
        req.customer?.id ?? null,
        sessionHeader(req),
      );
      res.status(201).json(cart);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  updateItem = async (req: CartRequest, res: Response): Promise<void> => {
    const [error, dto] = UpdateCartItemDto.create(req.body as Record<string, unknown>);
    if (error) { res.status(400).json({ error }); return; }
    try {
      const cart = await this.updateCartItemUseCase.execute(
        req.params.itemId,
        dto!,
        req.customer?.id ?? null,
        sessionHeader(req),
      );
      res.json(cart);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  removeItem = async (req: CartRequest, res: Response): Promise<void> => {
    try {
      const cart = await this.removeCartItemUseCase.execute(
        req.params.itemId,
        req.customer?.id ?? null,
        sessionHeader(req),
      );
      res.json(cart);
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
