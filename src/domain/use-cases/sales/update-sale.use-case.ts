import { CustomError } from '../../errors';
import { SaleEntity, SaleType, InstallmentFrequency } from '../../entities';
import { UpdateSaleDto } from '../../dtos/sales';
import { SaleRepository } from '../../repositories';
import { InstallmentCalculatorService } from '../../services/installments';

export class UpdateSaleUseCase {
  constructor(
    private readonly saleRepository: SaleRepository,
    private readonly installmentCalculator: InstallmentCalculatorService = new InstallmentCalculatorService(),
  ) {}

  async execute(id: string, dto: UpdateSaleDto): Promise<SaleEntity> {
    const sale = await this.saleRepository.findById(id);
    if (!sale) throw CustomError.notFound(`Venta con ID ${id} no encontrada`);

    // Validaciones de plan de cuotas
    if (dto.installmentsCount !== undefined || dto.frequency !== undefined) {
      if (sale.type !== SaleType.CREDIT) {
        throw CustomError.badRequest('El plan de cuotas solo aplica a ventas de tipo CREDIT');
      }
    }

    // La frecuencia efectiva después del update (para validar collectionDay2)
    const effectiveFrequency = dto.frequency ?? sale.frequency;

    // collectionDay2 solo es válido para BIWEEKLY
    if (dto.collectionDay2 !== undefined && dto.collectionDay2 !== null) {
      if (effectiveFrequency !== InstallmentFrequency.BIWEEKLY) {
        throw CustomError.badRequest('collectionDay2 solo aplica a ventas con frecuencia de cobro BIWEEKLY');
      }
    }

    // Si se cambia a MONTHLY, limpiar collectionDay2 automáticamente
    let resolvedCollectionDay2 = dto.collectionDay2;
    if (dto.frequency === InstallmentFrequency.MONTHLY && dto.collectionDay2 === undefined) {
      resolvedCollectionDay2 = null;
    }

    // Recalcular installmentAmount si cambia el plan o la cuota inicial
    let installmentAmount: number | undefined;
    const planChanged = dto.installmentsCount !== undefined || dto.initialPayment !== undefined;
    if (planChanged) {
      const effectiveCount = dto.installmentsCount ?? sale.installmentsCount;
      if (effectiveCount == null) {
        throw CustomError.badRequest(
          'La venta no tiene plan de cuotas. Envía installmentsCount y frequency para crear uno',
        );
      }
      const effectiveInitialPayment =
        dto.initialPayment !== undefined
          ? (dto.initialPayment ?? 0)
          : (sale.initialPayment ?? 0);
      const base = sale.total - effectiveInitialPayment;
      if (base <= 0) {
        throw CustomError.badRequest(
          'La cuota inicial no puede ser igual o mayor al total de la venta',
        );
      }
      installmentAmount = this.installmentCalculator.calculate(base, effectiveCount);
    }

    return await this.saleRepository.update(id, {
      collectionDay: dto.collectionDay,
      collectionDay2: resolvedCollectionDay2,
      createdAt: dto.createdAt,
      installmentsCount: dto.installmentsCount,
      frequency: dto.frequency,
      installmentAmount,
      initialPayment: dto.initialPayment,
    });
  }
}
