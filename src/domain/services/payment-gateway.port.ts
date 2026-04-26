import { OnlineOrderEntity } from '../entities/online-order.entity';

export type GatewayTransactionStatus = 'APPROVED' | 'DECLINED' | 'PENDING';

export interface IPaymentGateway {
  generatePaymentLink(order: OnlineOrderEntity): Promise<{ url: string; gatewayReference: string }>;
  verifyTransaction(paymentId: string): Promise<{
    status: GatewayTransactionStatus;
    amount: number;
    externalReference: string;
  }>;
  verifyWebhookSignature(rawBody: Buffer, headers: Record<string, string>): boolean;
  parseWebhookEvent(rawBody: Buffer): { eventId: string; paymentId: string };
}
