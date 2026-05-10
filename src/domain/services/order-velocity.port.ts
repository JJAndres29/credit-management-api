/**
 * Velocity signals for antifraud (P3). Implemented in infrastructure via Prisma counts on OnlineOrder.
 */
export interface OrderVelocityPort {
  countByIpSince(ip: string, since: Date): Promise<number>;
  countByGuestEmailSince(email: string, since: Date): Promise<number>;
  countByGuestPhoneSince(phone: string, since: Date): Promise<number>;
  countByCustomerSince(customerId: string, since: Date): Promise<number>;
}
