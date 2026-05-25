/**
 * Sanitized example — DTO validation at the HTTP boundary
 *
 * Factory returns [error?, dto?] tuple. Controllers throw 400 on error.
 * Use cases receive validated, typed objects only.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class CreatePaymentDto {
  private constructor(
    readonly clientId: string,
    readonly amount: number,
    readonly saleId: string | null,
    readonly note: string | null,
  ) {}

  static create(body: Record<string, unknown>): [string?, CreatePaymentDto?] {
    const { clientId, amount, saleId, note } = body;

    if (typeof clientId !== 'string' || !clientId.trim()) {
      return ['clientId is required'];
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return ['amount must be a positive number'];
    }

    if (Math.round(amount * 100) !== amount * 100) {
      return ['amount must have at most 2 decimal places'];
    }

    if (saleId !== undefined && saleId !== null && typeof saleId !== 'string') {
      return ['saleId must be a string or null'];
    }

    if (note !== undefined && note !== null) {
      if (typeof note !== 'string') return ['note must be a string'];
      if (note.length > 500) return ['note must be at most 500 characters'];
    }

    return [
      undefined,
      new CreatePaymentDto(
        clientId.trim(),
        amount,
        typeof saleId === 'string' ? saleId : null,
        typeof note === 'string' ? note : null,
      ),
    ];
  }
}

// Controller usage (presentation layer):
//
// const [error, dto] = CreatePaymentDto.create(req.body);
// if (error) return res.status(400).json({ message: error });
// const result = await useCase.execute(dto!, req.user.id, req.ip);
