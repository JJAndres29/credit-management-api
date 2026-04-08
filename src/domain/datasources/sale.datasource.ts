import { SaleEntity, SaleType } from '../entities';

/**
 * Datos ya validados y enriquecidos que llegan desde el use case.
 * Los precios unitarios vienen de los productos actuales (calculados en el use case),
 * no del cliente, para evitar manipulación de precios desde el frontend.
 */
export interface SaleCreateData {
  clientId: string;
  type: SaleType;
  total: number;
  items: {
    productId: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }[];
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
