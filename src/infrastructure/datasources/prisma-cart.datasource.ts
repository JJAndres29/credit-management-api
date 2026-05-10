import { prisma } from '../../config/prisma';
import {
  CartDatasource,
  CartData,
  CartLineUpsert,
} from '../../domain/datasources/cart.datasource';

function mapCart(raw: {
  id: string;
  sessionToken: string | null;
  customerId: string | null;
  items: Array<{
    id: string;
    productId: string;
    variantId: string;
    quantity: number;
    priceAtAdd: unknown;
    productNameSnapshot: string;
  }>;
}): CartData {
  return {
    id: raw.id,
    sessionToken: raw.sessionToken,
    customerId: raw.customerId,
    items: raw.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      variantId: i.variantId,
      quantity: i.quantity,
      priceAtAdd: Number(i.priceAtAdd),
      productNameSnapshot: i.productNameSnapshot,
    })),
  };
}

export class PrismaCartDatasource implements CartDatasource {
  async findByCustomerId(customerId: string): Promise<CartData | null> {
    const row = await prisma.cart.findUnique({
      where: { customerId },
      include: { items: true },
    });
    return row ? mapCart(row) : null;
  }

  async findBySessionToken(sessionToken: string): Promise<CartData | null> {
    const row = await prisma.cart.findUnique({
      where: { sessionToken },
      include: { items: true },
    });
    return row ? mapCart(row) : null;
  }

  async createForCustomer(customerId: string): Promise<CartData> {
    const row = await prisma.cart.create({
      data: { customerId },
      include: { items: true },
    });
    return mapCart(row);
  }

  async createWithSession(sessionToken: string): Promise<CartData> {
    const row = await prisma.cart.create({
      data: { sessionToken },
      include: { items: true },
    });
    return mapCart(row);
  }

  async upsertLineQuantity(cartId: string, line: CartLineUpsert): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.cartItem.findUnique({
        where: {
          cartId_variantId: { cartId, variantId: line.variantId },
        },
      });
      if (existing) {
        await tx.cartItem.update({
          where: { id: existing.id },
          data: { quantity: existing.quantity + line.quantity },
        });
      } else {
        await tx.cartItem.create({
          data: {
            cartId,
            productId: line.productId,
            variantId: line.variantId,
            quantity: line.quantity,
            priceAtAdd: line.priceAtAdd,
            productNameSnapshot: line.productNameSnapshot,
          },
        });
      }
      await tx.cart.update({ where: { id: cartId }, data: { updatedAt: new Date() } });
    });
  }

  async setLineQuantity(cartId: string, itemId: string, quantity: number): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const item = await tx.cartItem.findFirst({
        where: { id: itemId, cartId },
      });
      if (!item) return;
      if (quantity <= 0) {
        await tx.cartItem.delete({ where: { id: itemId } });
      } else {
        await tx.cartItem.update({
          where: { id: itemId },
          data: { quantity },
        });
      }
      await tx.cart.update({ where: { id: cartId }, data: { updatedAt: new Date() } });
    });
  }

  async removeLine(cartId: string, itemId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.cartItem.deleteMany({ where: { id: itemId, cartId } });
      await tx.cart.update({ where: { id: cartId }, data: { updatedAt: new Date() } });
    });
  }

  async mergeSessionIntoCustomer(sessionToken: string, customerId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const anon = await tx.cart.findUnique({
        where: { sessionToken },
        include: { items: true },
      });
      if (!anon || anon.items.length === 0) {
        if (anon) await tx.cart.delete({ where: { id: anon.id } });
        return;
      }

      let custCart = await tx.cart.findUnique({
        where: { customerId },
        include: { items: true },
      });

      if (!custCart) {
        await tx.cart.update({
          where: { id: anon.id },
          data: { customerId, sessionToken: null },
        });
        return;
      }

      for (const line of anon.items) {
        const existing = await tx.cartItem.findUnique({
          where: {
            cartId_variantId: { cartId: custCart.id, variantId: line.variantId },
          },
        });
        if (existing) {
          await tx.cartItem.update({
            where: { id: existing.id },
            data: { quantity: existing.quantity + line.quantity },
          });
        } else {
          await tx.cartItem.create({
            data: {
              cartId: custCart.id,
              productId: line.productId,
              variantId: line.variantId,
              quantity: line.quantity,
              priceAtAdd: line.priceAtAdd,
              productNameSnapshot: line.productNameSnapshot,
            },
          });
        }
      }

      await tx.cart.delete({ where: { id: anon.id } });
      await tx.cart.update({ where: { id: custCart.id }, data: { updatedAt: new Date() } });
    });
  }

  async deleteByCustomerId(customerId: string): Promise<void> {
    await prisma.cart.deleteMany({ where: { customerId } });
  }

  async deleteBySessionToken(sessionToken: string): Promise<void> {
    await prisma.cart.deleteMany({ where: { sessionToken } });
  }
}
