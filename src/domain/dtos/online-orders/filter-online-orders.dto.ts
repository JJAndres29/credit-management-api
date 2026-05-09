import { OrderStatus } from '../../entities/online-order.entity';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class FilterOnlineOrdersDto {
  private constructor(
    public readonly status?: OrderStatus,
    public readonly dateFrom?: Date,
    public readonly dateTo?: Date,
    public readonly customerId?: string,
  ) {}

  static create(object: Record<string, unknown>): [string?, FilterOnlineOrdersDto?] {
    const { status, dateFrom, dateTo, customerId } = object;

    let parsedStatus: OrderStatus | undefined;
    if (status !== undefined) {
      const valid = Object.values(OrderStatus) as string[];
      if (!valid.includes(status as string)) return [`status debe ser uno de: ${valid.join(', ')}`];
      parsedStatus = status as OrderStatus;
    }

    if (customerId !== undefined && (typeof customerId !== 'string' || !UUID_V4.test(customerId.trim()))) {
      return ['customerId debe ser un UUID v4 válido'];
    }

    let parsedFrom: Date | undefined;
    if (dateFrom !== undefined) {
      parsedFrom = new Date(dateFrom as string);
      if (isNaN(parsedFrom.getTime())) return ['dateFrom no es una fecha válida'];
    }

    let parsedTo: Date | undefined;
    if (dateTo !== undefined) {
      parsedTo = new Date(dateTo as string);
      if (isNaN(parsedTo.getTime())) return ['dateTo no es una fecha válida'];
      parsedTo.setHours(23, 59, 59, 999);
    }

    return [
      undefined,
      new FilterOnlineOrdersDto(
        parsedStatus,
        parsedFrom,
        parsedTo,
        typeof customerId === 'string' ? customerId.trim() : undefined,
      ),
    ];
  }
}
