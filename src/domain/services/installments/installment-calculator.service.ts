import { CustomError } from '../../errors';

/**
 * Domain Service: cálculo del monto de cada cuota en una venta a crédito.
 *
 * Responsabilidad única: dada la deuda total y el número de cuotas, devuelve
 * el monto redondeado a 2 decimales que el cliente pagará en cada período.
 *
 * No tiene dependencias externas ni estado — puede instanciarse libremente
 * y sus resultados son deterministas.
 *
 * Diseño deliberado:
 * - El total es el que viene del use case (suma de unitPrice × quantity por ítem).
 *   Este servicio solo divide, no aplica ningún recargo adicional.
 * - El redondeo es hacia el entero más cercano en centavos (banker's-safe).
 *   Si hubiera diferencia de centavos por redondeo acumulado, la última cuota
 *   absorbe la discrepancia — eso es responsabilidad del módulo de Pagos, no de este servicio.
 */
export class InstallmentCalculatorService {
  /**
   * Calcula el monto de cada cuota.
   *
   * @param total            Total de la venta (con recargo de crédito ya aplicado)
   * @param installmentsCount Número de cuotas — debe ser entero >= 1
   * @returns                Monto por cuota redondeado a 2 decimales
   */
  calculate(total: number, installmentsCount: number): number {
    if (!Number.isInteger(installmentsCount) || installmentsCount < 1) {
      throw CustomError.badRequest('El número de cuotas debe ser un entero mayor o igual a 1');
    }

    if (total <= 0) {
      throw CustomError.badRequest('El total de la venta debe ser mayor a 0 para calcular cuotas');
    }

    return Math.round((total / installmentsCount) * 100) / 100;
  }
}
