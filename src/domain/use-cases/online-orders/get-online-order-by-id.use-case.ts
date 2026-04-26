import { CustomError } from '../../errors';
import { OnlineOrderEntity } from '../../entities/online-order.entity';
import { OnlineOrderRepository } from '../../repositories/online-order.repository';

export class GetOnlineOrderByIdUseCase {
  constructor(private readonly onlineOrderRepository: OnlineOrderRepository) {}

  /**
   * @param id        — order UUID
   * @param customerId — set when a customer JWT is present; null for public/guest access
   * @param email      — required for public access (must match guestEmail or customerId mismatch guard)
   */
  async execute(
    id: string,
    customerId: string | null,
    email: string | null,
  ): Promise<OnlineOrderEntity> {
    const order = await this.onlineOrderRepository.findById(id);
    if (!order) throw CustomError.notFound('Orden no encontrada');

    if (customerId) {
      // Authenticated customer: must own the order
      if (order.customerId !== customerId) {
        throw CustomError.forbidden('No tienes permiso para ver esta orden');
      }
      return order;
    }

    // Public/guest access: require email to match
    if (!email) throw CustomError.badRequest('Se requiere email para consultar esta orden');

    const orderEmail = order.guestEmail ?? null;
    if (!orderEmail || orderEmail.toLowerCase() !== email.toLowerCase()) {
      throw CustomError.forbidden('El email no coincide con el de la orden');
    }

    return order;
  }
}
