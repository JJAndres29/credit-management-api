/**
 * Sanitized example — Domain Events after commit
 *
 * Side effects (email, WhatsApp, PDF) never run inside the transaction.
 * Subscribers in infrastructure/ listen asynchronously.
 */

interface EventEmitterPort {
  emit<T>(eventName: string, data: T): void;
}

interface PaymentEntity {
  id: string;
  clientId: string;
  amount: number;
}

interface PaymentRepository {
  create(data: unknown): Promise<PaymentEntity>;
}

const PAYMENT_REGISTERED = 'PaymentRegistered';

export class CompletePaymentUseCase {
  constructor(
    private readonly paymentRepo: PaymentRepository,
    private readonly eventEmitter?: EventEmitterPort,
  ) {}

  async execute(dto: unknown, userId: string, ip: string) {
    // ... validations omitted ...

    const payment = await this.paymentRepo.create({
      /* dto + auditLog — committed atomically in repository */
    });

    // Emit ONLY after successful commit — subscriber failures cannot rollback payment
    this.eventEmitter?.emit(PAYMENT_REGISTERED, {
      paymentId: payment.id,
      clientId: payment.clientId,
      amount: payment.amount,
      newBalance: 0, // computed in real use case
      note: null,
    });

    return { payment };
  }
}

// infrastructure/subscribers/payment-notification.subscriber.ts (conceptual)
//
// eventEmitter.on(PAYMENT_REGISTERED, async (data) => {
//   try {
//     await Promise.allSettled([sendEmail(data), buildWhatsAppPayload(data)]);
//     await logNotificationAttempt(data, 'SENT');
//   } catch {
//     // Never throws — HTTP response already sent
//   }
// });
