import { CustomError } from '../../errors';
import { SaleEntity, SaleType, AuditAction } from '../../entities';
import { CreateSaleDto } from '../../dtos/sales';
import { SaleRepository, PaymentRepository } from '../../repositories';
import { ClientRepository } from '../../repositories';
import { ProductRepository } from '../../repositories';
import { InstallmentCalculatorService } from '../../services/installments';
import { EventEmitterPort, CREDIT_SALE_CREATED, PAYMENT_REGISTERED } from '../../events';

export interface WhatsAppPayload {
  phone: string;
  message: string;
}

export interface CreateSaleResult {
  sale: SaleEntity;
  whatsappPayload: WhatsAppPayload | null;
}

export class CreateSaleUseCase {
  constructor(
    private readonly saleRepository: SaleRepository,
    private readonly clientRepository: ClientRepository,
    private readonly productRepository: ProductRepository,
    private readonly eventEmitter?: EventEmitterPort,
    private readonly installmentCalculator: InstallmentCalculatorService = new InstallmentCalculatorService(),
    private readonly paymentRepository?: PaymentRepository,
  ) {}

  async execute(dto: CreateSaleDto, userId: string, ip: string): Promise<CreateSaleResult> {
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
    //    Si hay cuota inicial, las cuotas se calculan sobre el saldo restante.
    const initialPayment = dto.initialPayment ?? 0;
    let installmentAmount: number | undefined;
    if (dto.type === SaleType.CREDIT && dto.installmentsCount !== undefined) {
      const baseForInstallments = Math.max(total - initialPayment, 0);
      installmentAmount = this.installmentCalculator.calculate(baseForInstallments, dto.installmentsCount);
    }

    // 6. Validar que la cuota inicial no supere el total de la venta
    if (initialPayment > 0 && initialPayment >= total) {
      throw CustomError.badRequest(
        `La cuota inicial ($${initialPayment.toFixed(2)}) debe ser menor al total de la venta ($${total.toFixed(2)})`,
      );
    }

    // 7. Persistir en una transacción atómica.
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
      initialPayment: initialPayment > 0 ? initialPayment : undefined,
    });

    // 8. Registrar la cuota inicial como pago si se proporcionó.
    let finalBalance = balanceBefore + total;
    if (initialPayment > 0 && this.paymentRepository) {
      await this.paymentRepository.create({
        clientId: dto.clientId,
        saleId: sale.id,
        amount: initialPayment,
        note: 'Cuota inicial',
        saleTotal: total,
        auditLog: {
          userId,
          action: AuditAction.PAYMENT,
          before: balanceBefore + total,
          after: balanceBefore + total - initialPayment,
          ip,
        },
      });
      finalBalance = balanceBefore + total - initialPayment;

      this.eventEmitter?.emit(PAYMENT_REGISTERED, {
        paymentId: sale.id,
        clientId: dto.clientId,
        amount: initialPayment,
        newBalance: finalBalance,
        note: 'Cuota inicial',
        saleInstallmentsCount: dto.installmentsCount ?? null,
        saleInstallmentAmount: installmentAmount ?? null,
        saleTotalPaidAfter: initialPayment,
      });
    }

    // 9. Emitir evento solo para ventas CREDIT (generan deuda → cliente debe saber).
    if (dto.type === SaleType.CREDIT) {
      this.eventEmitter?.emit(CREDIT_SALE_CREATED, {
        saleId: sale.id,
        clientId: dto.clientId,
        total,
        newBalance: finalBalance,
        installmentsCount: dto.installmentsCount ?? null,
        installmentAmount: installmentAmount ?? null,
      });
    }

    const fmt = (n: number) =>
      new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
    const fmtDate = (d: Date) => {
      const parts = new Intl.DateTimeFormat('es-CO', {
        timeZone: 'America/Bogota',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).formatToParts(d);
      const day = parts.find((p) => p.type === 'day')!.value;
      const month = parts.find((p) => p.type === 'month')!.value;
      const year = parts.find((p) => p.type === 'year')!.value;
      return `${day}-${month}-${year}`;
    };

    let whatsappPayload: WhatsAppPayload | null = null;

    if (client.phone) {
      if (dto.type === SaleType.CREDIT) {
        let body =
          `***\nESTADO DE CUENTA\n***\n\n` +
          `Sr(a) ${client.name}, el estado de cuenta de su crédito No.${sale.saleNumber} es el siguiente:\n\n` +
          `Fecha inicial ${fmtDate(sale.createdAt)}.\n\n` +
          `Valor del crédito ${fmt(total)}.`;

        if (installmentAmount && dto.installmentsCount) {
          if (initialPayment > 0) {
            body +=
              `\n\nCuota inicial aplicada el ${fmtDate(sale.createdAt)} por valor de ${fmt(initialPayment)}.` +
              `\n\nCuotas pagadas 0,00 de ${dto.installmentsCount}.`;
          } else {
            body +=
              `\n\nCuotas pactadas ${dto.installmentsCount} de ${fmt(installmentAmount)} cada una.`;
          }
        }

        body += `\n\nSu nuevo saldo es ${fmt(finalBalance)}.`;
        whatsappPayload = { phone: client.phone, message: body };
      } else {
        whatsappPayload = {
          phone: client.phone,
          message:
            `***\nCOMPRA REGISTRADA\n***\n\n` +
            `Sr(a) ${client.name}, se registró una compra de contado el ${fmtDate(sale.createdAt)} ` +
            `por valor de ${fmt(total)}. Ref: #${sale.saleNumber}`,
        };
      }
    }

    return { sale, whatsappPayload };
  }
}
