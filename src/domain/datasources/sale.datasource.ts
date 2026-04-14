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
    productId: string;
    quantity: number;
    /** Precio base del producto (Product.price) al momento de la venta */
    basePrice: number;
    /** Precio final cobrado (puede incluir recargo de crédito) */
    unitPrice: number;
    subtotal: number;
    /** Regla de pricing aplicada. Ej: "CASH_BASE" | "CREDIT_SURCHARGE_15PCT" */
    appliedRule: string;
  }[];
  auditLog?: AuditLogData;
  /** Número de cuotas pactadas. Solo presente si la venta tiene plan de cuotas. */
  installmentsCount?: number;
  /** Periodicidad del pago (MONTHLY | BIWEEKLY). Solo presente si hay plan de cuotas. */
  frequency?: InstallmentFrequency;
  /** Monto por cuota = total / installmentsCount. Calculado por InstallmentCalculatorService. */
  installmentAmount?: number;
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
}
