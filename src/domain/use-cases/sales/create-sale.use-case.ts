import { CustomError } from '../../errors';
import { SaleEntity, SaleType, AuditAction } from '../../entities';
import { CreateSaleDto } from '../../dtos/sales';
import { SaleRepository } from '../../repositories';
import { ClientRepository } from '../../repositories';
import { ProductRepository } from '../../repositories';
import { PricingService } from '../../services/pricing';
import { EventEmitterPort, CREDIT_SALE_CREATED } from '../../events';

export class CreateSaleUseCase {
  constructor(
    private readonly saleRepository: SaleRepository,
    private readonly clientRepository: ClientRepository,
    private readonly productRepository: ProductRepository,
    /**
     * PricingService determina qué precio aplicar según el contexto de la venta.
     * Se inyecta como dependencia para que el use case sea testeable de forma aislada
     * y para que el composition root controle qué strategies están activas.
     */
    private readonly pricingService: PricingService,
    /**
     * Opcional: si no se inyecta (e.g. en tests), las notificaciones se omiten
     * sin romper la lógica de negocio ni los tests existentes.
     */
    private readonly eventEmitter?: EventEmitterPort,
  ) {}

  async execute(dto: CreateSaleDto, userId: string, ip: string): Promise<SaleEntity> {
    // 1. Verificar que el cliente existe y está activo
    const client = await this.clientRepository.findById(dto.clientId);
    if (!client) throw CustomError.notFound(`Cliente con ID ${dto.clientId} no encontrado`);

    // 2. Validar cada producto y calcular precio con la strategy correspondiente
    const enrichedItems: {
      productId: string;
      quantity: number;
      basePrice: number;
      unitPrice: number;
      subtotal: number;
      appliedRule: string;
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

      // El PricingService selecciona automáticamente la strategy correcta según
      // el tipo de venta (CASH → CashPricingStrategy, CREDIT → CreditPricingStrategy).
      // El use case no sabe cómo se calcula el precio — esa responsabilidad es del servicio.
      const pricing = this.pricingService.calculate({
        product,
        saleType: dto.type,
        client,
        quantity: item.quantity,
        saleDate: new Date(),
      });

      enrichedItems.push({
        productId: item.productId,
        quantity: item.quantity,
        basePrice: pricing.basePrice,
        unitPrice: pricing.unitPrice,
        subtotal: pricing.unitPrice * item.quantity,
        appliedRule: pricing.appliedRule,
      });
    }

    // 3. Calcular el total de la venta con los precios ya aplicados
    const total = enrichedItems.reduce((sum, item) => sum + item.subtotal, 0);

    // 4. Para ventas a crédito: verificar que el cliente tiene crédito disponible
    //    La verificación usa el total con recargo, que es el que se registrará como deuda
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

    const sale = await this.saleRepository.create({
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

    // 6. Emitir evento solo para ventas CREDIT (generan deuda → cliente debe saber).
    //    Se emite DESPUÉS de que la transacción se commitea.
    //    La notificación es best-effort — si falla, la venta ya está registrada.
    if (dto.type === SaleType.CREDIT) {
      this.eventEmitter?.emit(CREDIT_SALE_CREATED, {
        saleId: sale.id,
        clientId: dto.clientId,
        total,
        newBalance: balanceBefore + total,
      });
    }

    return sale;
  }
}
