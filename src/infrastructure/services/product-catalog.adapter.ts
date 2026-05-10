import { prisma } from '../../config/prisma';
import {
  ProductCatalogPort,
  ProductForOrder,
  StockIncrementOptions,
} from '../../domain/services/product-catalog.port';

export class ProductCatalogAdapter implements ProductCatalogPort {
  async getForOrder(productId: string): Promise<ProductForOrder | null> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        categoryId: true,
        retailPrice: true,
        stock: true,
        isActive: true,
        ivaRate: true,
        category: { select: { ivaRate: true } },
        variants: {
          where: { isDefault: true },
          take: 1,
          select: { id: true },
        },
      },
    });
    if (!product) return null;
    const def = product.variants[0];
    return {
      id: product.id,
      name: product.name,
      categoryId: product.categoryId ?? null,
      retailPrice: product.retailPrice != null ? Number(product.retailPrice) : null,
      stock: product.stock,
      isActive: product.isActive,
      defaultVariantId: def?.id ?? null,
      productIvaRate: product.ivaRate != null ? Number(product.ivaRate) : null,
      categoryIvaRate:
        product.category?.ivaRate != null ? Number(product.category.ivaRate) : null,
    };
  }

  async decrementStockAtomic(productId: string, qty: number): Promise<boolean> {
    try {
      const ok = await prisma.$transaction(async (tx) => {
        const p = await tx.product.updateMany({
          where: { id: productId, stock: { gte: qty }, isActive: true },
          data: { stock: { decrement: qty } },
        });
        if (p.count === 0) return false;

        const v = await tx.productVariant.updateMany({
          where: { productId, isDefault: true, stock: { gte: qty } },
          data: { stock: { decrement: qty } },
        });
        if (v.count === 0) {
          throw new Error(`ProductVariant stock desincronizado para productId=${productId}`);
        }
        return true;
      });
      return ok;
    } catch {
      return false;
    }
  }

  async incrementStock(
    productId: string,
    qty: number,
    opts?: StockIncrementOptions,
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: productId },
        data: { stock: { increment: qty } },
      });

      const variant = await tx.productVariant.findFirst({
        where: { productId, isDefault: true },
        select: { id: true },
      });

      if (variant) {
        await tx.productVariant.update({
          where: { id: variant.id },
          data: { stock: { increment: qty } },
        });
      }

      if (opts?.orderId && variant) {
        await tx.stockMovement.create({
          data: {
            productId,
            variantId: variant.id,
            movementType: 'SALE_ONLINE_RELEASE',
            quantityDelta: qty,
            refOrderId: opts.orderId,
            note: opts.movementNote ?? null,
          },
        });
      }
    });
  }
}
