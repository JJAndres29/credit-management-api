import { SaleEntity, SaleType, InstallmentFrequency } from '../entities';
import { AuditLogData } from './audit-log.datasource';
import { FilterSalesDto } from '../dtos/sales';
import { PaginationDto } from '../dtos/shared';
import { PaginatedResult } from '../types/paginated.type';

/**
 * Datos ya validados y enriquecidos que llegan desde el use case.
 * Los precios unitarios vienen de los productos actuales (calculados en el use case),
 * no del cliente, para evitar manipulación de precios desde el frontend.
 *
 * `auditLog` solo se incluye en ventas CREDIT porque son las únicas que modifican
 * el balance del cliente. Las ventas CASH no generan cambio de balance.
 *
 * Los campos de cuotas (`installmentsCount`, `frequency`, `installmentAmount`) son
 * opcionales y solo se incluyen cuando la venta tiene un plan de cuotas definido.
 */
export interface SaleCreateData {
  clientId: string;
  type: SaleType;
  total: number;
  items: {
    /**
     * ID de un producto existente. Vacío cuando `newProduct` está presente —
     * el datasource lo completa al crear el producto dentro de la transacción.
     */
    productId: string;
    quantity: number;
    /** Precio base del producto (Product.price) al momento de la venta */
    basePrice: number;
    /** Precio final cobrado (puede incluir recargo de crédito) */
    unitPrice: number;
    subtotal: number;
    /** Null desde que el precio se fija manualmente en el momento de la venta. */
    appliedRule: string | null;
    /** Presente solo cuando el vendedor crea el producto inline al registrar la venta. */
    newProduct?: { name: string; stock: number };
  }[];
  auditLog?: AuditLogData;
  /** Número de cuotas pactadas. Solo presente si la venta tiene plan de cuotas. */
  installmentsCount?: number;
  /** Periodicidad del pago (MONTHLY | BIWEEKLY). Solo presente si hay plan de cuotas. */
  frequency?: InstallmentFrequency;
  /** Monto por cuota = total / installmentsCount. Calculado por InstallmentCalculatorService. */
  installmentAmount?: number;
  /**
   * Día del mes para el cobro (1-31).
   * MONTHLY: único día de cobro.  BIWEEKLY: primer día de cobro.
   */
  collectionDay?: number;
  /** Segundo día de cobro (1-31). Exclusivo para planes BIWEEKLY. */
  collectionDay2?: number;
  /**
   * Cuota inicial abonada al crear la venta. Se persiste para que CreatePaymentUseCase
   * pueda calcular correctamente: paidInstallments = (totalPaid - initialPayment) / installmentAmount
   */
  initialPayment?: number;
  /**
   * Fecha real en que ocurrió la venta. Si no se provee, Prisma usa now().
   * Permite registrar ventas de días anteriores o corregir la fecha por error de digitación.
   */
  createdAt?: Date;
}

export interface SaleUpdateData {
  /** Día del mes para el cobro (1-31). null para limpiar el valor. */
  collectionDay?: number | null;
  /** Segundo día de cobro (1-31), solo planes BIWEEKLY. null para limpiar. */
  collectionDay2?: number | null;
  /** Fecha real de la venta. Permite corregir errores de digitación. */
  createdAt?: Date;
}

export interface SaleDatasource {
  findAll(pagination: PaginationDto, filters: FilterSalesDto): Promise<PaginatedResult<SaleEntity>>;
  findById(id: string): Promise<SaleEntity | null>;
  findByClientId(clientId: string): Promise<SaleEntity[]>;
  /**
   * Crea la venta, sus ítems, descuenta stock y actualiza balance del cliente
   * todo en una única transacción atómica de base de datos.
   */
  create(data: SaleCreateData): Promise<SaleEntity>;
  /**
   * Actualiza campos no financieros de una venta: días de cobro y/o fecha.
   * No modifica totales, estado ni ítems — eso sucede mediante pagos.
   */
  update(id: string, data: SaleUpdateData): Promise<SaleEntity>;
}
