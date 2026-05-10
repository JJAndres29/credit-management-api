import { prisma } from '../../config/prisma';
import { CustomError } from '../../domain/errors';
import { ShippingQuotePort } from '../../domain/services/shipping-quote.port';
import { computeShippingFeeCop } from '../../domain/services/shipping-calculator';

export class PrismaShippingQuoteAdapter implements ShippingQuotePort {
  async quoteShippingCop(zoneCode: string, weightKg: number, merchandiseSubtotalCop: number): Promise<number> {
    const zone = await prisma.shippingZone.findUnique({
      where: { code: zoneCode },
      include: {
        rates: { orderBy: { code: 'asc' }, take: 1 },
      },
    });
    if (!zone || zone.rates.length === 0) {
      throw CustomError.badRequest(`Zona de envío desconocida: ${zoneCode}`);
    }
    const rate = zone.rates[0];
    return computeShippingFeeCop({
      baseFee: Number(rate.baseFee),
      perKg: rate.perKg != null ? Number(rate.perKg) : null,
      weightKg,
      freeAbove: rate.freeAbove != null ? Number(rate.freeAbove) : null,
      merchandiseSubtotalCop,
    });
  }
}
