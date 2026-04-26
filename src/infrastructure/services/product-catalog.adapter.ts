import { prisma } from '../../config/prisma';
import { ProductCatalogPort, ProductForOrder } from '../../domain/services/product-catalog.port';

export class ProductCatalogAdapter implements ProductCatalogPort {
  async getForOrder(productId: string): Promise<ProductForOrder | null> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, retailPrice: true, stock: true, isActive: true },
    });
    if (!product) return null;
    return {
      id: product.id,
      name: product.name,
      retailPrice: product.retailPrice != null ? Number(product.retailPrice) : null,
      stock: product.stock,
      isActive: product.isActive,
    };
  }

  async decrementStockAtomic(productId: string, qty: number): Promise<boolean> {
    // Conditional update: only decrement when current stock >= qty
    const result = await prisma.product.updateMany({
      where: { id: productId, stock: { gte: qty }, isActive: true },
      data: { stock: { decrement: qty } },
    });
    return result.count > 0;
  }

  async incrementStock(productId: string, qty: number): Promise<void> {
    await prisma.product.update({
      where: { id: productId },
      data: { stock: { increment: qty } },
    });
  }
}
