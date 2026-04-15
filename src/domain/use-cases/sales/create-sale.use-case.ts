import { CustomError } from '../../errors';
import { SaleEntity, SaleType, AuditAction } from '../../entities';
import { CreateSaleDto } from '../../dtos/sales';
import { SaleRepository } from '../../repositories';
import { ClientRepository } from '../../repositories';
import { ProductRepository } from '../../repositories';
import { InstallmentCalculatorService } from '../../services/installments';
import { EventEmitterPort, CREDIT_SALE_CREATED } from '../../events';

export class CreateSaleUseCase {
  constructor(
    private readonly saleRepository: SaleRepository,
    private readonly clientRepository: ClientRepository,
    private readonly productRepository: ProductRepository,
    /**
     * Opcional: si no se inyecta (e.g. en tests), las notificaciones se omiten
     * sin romper la lógica de negocio ni los tests existentes.
     */
    private readonly eventEmitter?: EventEmitterPort,
    /**
     * Domain Service para el cálculo del monto de cada cuota.
     * Tiene un valor por defecto para no romper tests ni llamadas existentes.
     * El composition root (sale.router.ts) lo instancia explícitamente.
     */
    private readonly installmentCalculator: InstallmentCalculatorService = new InstallmentCalculatorService(),
  ) {}

  async execute(dto: CreateSaleDto, userId: string, ip: string): Promise<SaleEntity> {
    // 1. Verificar que el cliente existe y está activo
    const client = await this.clientRepository.findById(dto.clientId);
    if (!client) throw CustomError.notFound(`Cliente con ID ${dto.clientId} no encontrado`);

    // 2. Validar cada producto y construir ítems enriquecidos.
    //    El precio unitario viene del DTO (fijado en el momento de la venta),
    //    por lo que el servidor solo valida existencia, estado y stock del producto.
    const enrichedItems: {
      productId: string;
      quantity: number;
      basePrice: number;
      unitPrice: number;
      subtotal: number;
      appliedRule: null;
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

      const unitPrice = Math.round(item.unitPrice * 100) / 100;
      const subtotal = Math.round(unitPrice * item.quantity * 100) / 100;

      enrichedItems.push({
        productId: item.productId,
        quantity: item.quantity,
        basePrice: unitPrice,   // precio registrado al momento de la venta
        unitPrice,
        subtotal,
        appliedRule: null,
      });
    }

    // 3. Calcular el total de la venta
    const total = Math.round(enrichedItems.reduce((sum, item) => sum + item.subtotal, 0) * 100) / 100;

    // 4. Para ventas a crédito: verificar que el cliente tiene crédito disponible
    if (dto.type === SaleType.CREDIT) {
      const creditAvailable = Number(client.creditLimit) - Number(client.balance);

      if (creditAvailable < total) {
        throw CustomError.badRequest(
          `Crédito insuficiente. Disponible: $${creditAvailable.toFixed(2)}, requerido: $${total.toFixed(2)}`,
        );
      }
    }

    // 5. Calcular monto de cuota cuando el DTO incluye plan de cuotas.
    let installmentAmount: number | undefined;
    if (dto.type === SaleType.CREDIT && dto.installmentsCount !== undefined) {
      installmentAmount = this.installmentCalculator.calculate(total, dto.installmentsCount);
    }

    // 6. Persistir en una transacción atómica.
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
      installmentsCount: dto.installmentsCount,
      frequency: dto.frequency,
      installmentAmount,
      collectionDay: dto.collectionDay,
      collectionDay2: dto.collectionDay2,
    });

    // 7. Emitir evento solo para ventas CREDIT (generan deuda → cliente debe saber).
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
