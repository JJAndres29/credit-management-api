/**
 * Resultado del cálculo de precio producido por una PricingStrategy.
 *
 * Separa el precio base del precio final para que el sistema siempre tenga
 * trazabilidad de cuánto costaba el producto originalmente y cuánto se cobró.
 *
 * `appliedRule` es un identificador máquina-legible que se persiste en SaleItem.
 * Permite responder en el futuro: "¿qué regla se aplicó en esta venta?"
 * sin tener que reconstruir el estado del negocio.
 */
export interface PricingResult {
  /** Precio original del producto (Product.price) — snapshot inmutable */
  basePrice: number;
  /** Precio final a cobrar por unidad (puede incluir recargo o descuento) */
  unitPrice: number;
  /** Diferencia entre unitPrice y basePrice. Positivo = recargo, negativo = descuento */
  surchargeAmount: number;
  /** Nombre de la regla aplicada. Ej: "CASH_BASE" | "CREDIT_SURCHARGE_15PCT" */
  appliedRule: string;
}
