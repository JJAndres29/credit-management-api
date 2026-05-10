import { prisma } from '../../config/prisma';
import { OrderVelocityPort } from '../../domain/services/order-velocity.port';

export class PrismaOrderVelocityAdapter implements OrderVelocityPort {
  async countByIpSince(ip: string, since: Date): Promise<number> {
    return prisma.onlineOrder.count({
      where: {
        ipAddress: ip,
        createdAt: { gte: since },
      },
    });
  }

  async countByGuestEmailSince(email: string, since: Date): Promise<number> {
    return prisma.onlineOrder.count({
      where: {
        guestEmail: { equals: email, mode: 'insensitive' },
        createdAt: { gte: since },
      },
    });
  }

  async countByGuestPhoneSince(phone: string, since: Date): Promise<number> {
    return prisma.onlineOrder.count({
      where: {
        guestPhone: phone,
        createdAt: { gte: since },
      },
    });
  }

  async countByCustomerSince(customerId: string, since: Date): Promise<number> {
    return prisma.onlineOrder.count({
      where: {
        customerId,
        createdAt: { gte: since },
      },
    });
  }
}
