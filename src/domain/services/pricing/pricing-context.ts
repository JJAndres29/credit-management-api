import { ProductEntity } from '../../entities/product.entity';
import { ClientEntity } from '../../entities/client.entity';
import { SaleType } from '../../entities/sale.entity';

/**
 * Contexto de entrada para el cálculo de precio.
 *
 * Contiene toda la información que una PricingStrategy puede necesitar
 * para decidir qué precio aplicar. El contexto es inmutable — las strategies
 * lo leen, nunca lo modifican.
 *
 * Incluir `client` y `saleDate` desde el inicio permite que futuras strategies
 * (mayoristas, promociones por fecha, etc.) funcionen sin cambiar esta interfaz.
 */
export interface PricingContext {
  /** Producto que se está vendiendo */
  product: ProductEntity;
  /** Tipo de venta: CASH o CREDIT */
  saleType: SaleType;
  /** Cliente que realiza la compra */
  client: ClientEntity;
  /** Cantidad de unidades (permite descuentos por volumen en el futuro) */
  quantity: number;
  /** Fecha de la venta (permite promociones por fecha en el futuro) */
  saleDate: Date;
}
