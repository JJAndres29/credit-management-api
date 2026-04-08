import { SaleEntity, SaleType } from '../entities';
import { AuditLogData } from './audit-log.datasource';

/**
 * Datos ya validados y enriquecidos que llegan desde el use case.
 * Los precios unitarios vienen de los productos actuales (calculados en el use case),
 * no del cliente, para evitar manipulación de precios desde el frontend.
 *
 * `auditLog` solo se incluye en ventas CREDIT porque son las únicas que modifican
 * el balance del cliente. Las ventas CASH no generan cambio de balance.
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
}

export interface SaleDatasource {
  findAll(): Promise<SaleEntity[]>;
  findById(id: string): Promise<SaleEntity | null>;
  findByClientId(clientId: string): Promise<SaleEntity[]>;
  /**
   * Crea la venta, sus ítems, descuenta stock y actualiza balance del cliente
   * todo en una única transacción atómica de base de datos.
   */
  create(data: SaleCreateData): Promise<SaleEntity>;
}
