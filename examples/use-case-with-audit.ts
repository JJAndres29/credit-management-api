/**
 * Sanitized example — Use Case + Atomic Audit Log
 *
 * Pattern used in CreatePaymentUseCase, CreateSaleUseCase, DeletePaymentUseCase, etc.
 * The real implementation adds sale linkage, installment math, and WhatsApp payloads.
 */

interface AuditLogData {
  userId: string;
  action: string;
  before: number;
  after: number;
  ip: string;
}

interface PaymentCreateData {
  clientId: string;
  amount: number;
  auditLog: AuditLogData;
}

interface PaymentRepository {
  create(data: PaymentCreateData): Promise<{ id: string; amount: number }>;
}

interface ClientRepository {
  findById(id: string): Promise<{ id: string; balance: number; isActive: boolean } | null>;
}

class CustomError extends Error {
  static notFound(msg: string) {
    return new CustomError(msg);
  }
  static badRequest(msg: string) {
    return new CustomError(msg);
  }
}

export class RegisterPaymentUseCase {
  constructor(
    private readonly paymentRepo: PaymentRepository,
    private readonly clientRepo: ClientRepository,
  ) {}

  async execute(input: { clientId: string; amount: number }, userId: string, ip: string) {
    const client = await this.clientRepo.findById(input.clientId);
    if (!client) throw CustomError.notFound('Client not found');
    if (!client.isActive) throw CustomError.badRequest('Client inactive');
    if (input.amount > client.balance) {
      throw CustomError.badRequest('Amount exceeds balance');
    }

    const before = client.balance;
    const after = before - input.amount;

    // Repository runs prisma.$transaction: payment + balance + auditLog
    const payment = await this.paymentRepo.create({
      clientId: input.clientId,
      amount: input.amount,
      auditLog: {
        userId,
        action: 'PAYMENT',
        before,
        after,
        ip,
      },
    });

    return payment;
  }
}
