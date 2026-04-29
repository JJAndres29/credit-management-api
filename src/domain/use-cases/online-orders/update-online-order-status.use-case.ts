import { OnlineOrderRepository } from '../../repositories/online-order.repository';
import { SaleRepository } from '../../repositories/sale.repository';
import { CustomerRepository } from '../../repositories/customer.repository';
import { OnlineOrderEntity } from '../../entities/online-order.entity';
import { CustomError } from '../../errors';
import { UpdateOnlineOrderStatusDto } from '../../dtos/online-orders/update-online-order-status.dto';
import { SaleType } from '../../entities';

export class UpdateOnlineOrderStatusUseCase {
  constructor(
    private readonly orderRepository: OnlineOrderRepository,
    private readonly saleRepository?: SaleRepository,
    private readonly customerRepository?: CustomerRepository,
  ) {}

  async execute(id: string, dto: UpdateOnlineOrderStatusDto): Promise<OnlineOrderEntity> {
    const order = await this.orderRepository.findById(id);
    if (!order) throw CustomError.notFound('Order not found');

    const updated = await this.orderRepository.updateStatus(id, dto.status);

    if (dto.status === 'PAID' && this.saleRepository && this.customerRepository) {
      await this.createSaleFromOrder(order);
    }

    return updated;
  }

  private async createSaleFromOrder(order: OnlineOrderEntity): Promise<void> {
    if (!order.customerId) return; // guest orders: no Sale
    const customer = await this.customerRepository!.findById(order.customerId);
    if (!customer?.clientId) return; // customer not linked to a Client

    try {
      await this.saleRepository!.create({
        clientId: customer.clientId,
        type: SaleType.CASH,
        total: order.totalAmount,
        items: order.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.quantity * item.unitPrice,
          basePrice: item.unitPrice,
          appliedRule: null,
          newProduct: undefined,
        })),
        skipStockDecrement: true,
        auditLog: undefined,
      });
    } catch {
      // Sale creation is a best-effort side-effect; never block the status update
    }
  }
}
