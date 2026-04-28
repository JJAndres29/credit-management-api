export class UpdateOnlineOrderStatusDto {
  private constructor(public readonly status: 'PAID' | 'CANCELLED' | 'EXPIRED') {}

  static create(body: Record<string, unknown>): [string?, UpdateOnlineOrderStatusDto?] {
    const { status } = body;
    if (!status) return ['status is required'];
    if (!['PAID', 'CANCELLED', 'EXPIRED'].includes(status as string))
      return ['status must be PAID, CANCELLED or EXPIRED'];
    return [undefined, new UpdateOnlineOrderStatusDto(status as 'PAID' | 'CANCELLED' | 'EXPIRED')];
  }
}
