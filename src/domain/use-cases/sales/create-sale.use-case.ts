import { CustomError } from '../../errors';
import { SaleEntity, SaleType, AuditAction } from '../../entities';
import { CreateSaleDto } from '../../dtos/sales';
import { SaleRepository } from '../../repositories';
import { ClientRepository } from '../../repositories';
import { ProductRepository } from '../../repositories';

export class CreateSaleUseCase {
  constructor(
    private readonly saleRepository: SaleRepository,
    private readonly clientRepository: ClientRepository,
    private readonly productRepository: ProductRepository,
  ) {}

  async execute(dto: CreateSaleDto, userId: string, ip: string): Promise<SaleEntity> {
    // 1. Verificar que el cliente existe y está activo
    const client = await this.clientRepository.findById(dto.clientId);
    if (!client) throw CustomError.notFound(`Cliente con ID ${dto.clientId} no encontrado`);

    // 2. Validar cada producto: existe, está activo y tiene stock suficiente
    const enrichedItems: {
      productId: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
    }[] = [];

    for (const item of dto.items) {
      const product = await this.productRepository.findById(item.productId);

      if (!product) {
        throw CustomError.notFound(`Producto con ID ${item.productId} no encontrado`);
      }

      if (!product.isActive) {
        throw CustomError.badRequest(`El producto "${product.name}" no está disponible`);
      }

      if (product.stock < item.quantity) {
        throw CustomError.badRequest(
          `Stock insuficiente para "${product.name}": disponible ${product.stock}, solicitado ${item.quantity}`,
        );
      }

      const unitPrice = Number(product.price);
      const subtotal = unitPrice * item.quantity;

      enrichedItems.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice,
        subtotal,
      });
    }

    // 3. Calcular el total de la venta
    const total = enrichedItems.reduce((sum, item) => sum + item.subtotal, 0);

    // 4. Para ventas a crédito: verificar que el cliente tiene crédito disponible
    if (dto.type === SaleType.CREDIT) {
      const creditAvailable = Number(client.creditLimit) - Number(client.balance);

      if (creditAvailable < total) {
        throw CustomError.badRequest(
          `Crédito insuficiente. Disponible: $${creditAvailable.toFixed(2)}, requerido: $${total.toFixed(2)}`,
        );
      }
    }

    // 5. Persistir: la transacción en el datasource se encarga de crear la venta,
    //    sus ítems, descontar stock y actualizar el balance del cliente (si es crédito).
    //    Para ventas CREDIT se incluye el audit log para que quede dentro de la
    //    misma transacción atómica — si la venta falla, el log también se revierte.
    const balanceBefore = Number(client.balance);

    return this.saleRepository.create({
      clientId: dto.clientId,
      type: dto.type,
      total,
      items: enrichedItems,
      auditLog:
        dto.type === SaleType.CREDIT
          ? {
              userId,
              action: AuditAction.CREDIT_SALE,
              before: balanceBefore,
              after: balanceBefore + total,
              ip,
            }
          : undefined,
    });
  }
}
