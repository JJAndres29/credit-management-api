import { OnlineOrderRepository } from '../../repositories/online-order.repository';
import { OnlineOrderEntity } from '../../entities/online-order.entity';
import { CustomError } from '../../errors';
import { UpdateOnlineOrderStatusDto } from '../../dtos/online-orders/update-online-order-status.dto';

export class UpdateOnlineOrderStatusUseCase {
  constructor(private readonly orderRepository: OnlineOrderRepository) {}

  async execute(id: string, dto: UpdateOnlineOrderStatusDto): Promise<OnlineOrderEntity> {
    const order = await this.orderRepository.findById(id);
    if (!order) throw CustomError.notFound('Order not found');

    return this.orderRepository.updateStatus(id, dto.status);
  }
}
