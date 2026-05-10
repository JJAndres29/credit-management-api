import { prisma } from '../../config/prisma';
import {
  ShippingZoneDatasource,
  ShippingZonePublic,
} from '../../domain/datasources/shipping-zone.datasource';

export class PrismaShippingZoneDatasource implements ShippingZoneDatasource {
  async findAllPublic(): Promise<ShippingZonePublic[]> {
    const rows = await prisma.shippingZone.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { rates: { orderBy: { code: 'asc' } } },
    });
    return rows.map((z) => ({
      id: z.id,
      code: z.code,
      name: z.name,
      sortOrder: z.sortOrder,
      rates: z.rates.map((r) => ({
        id: r.id,
        code: r.code,
        baseFee: Number(r.baseFee),
        perKg: r.perKg != null ? Number(r.perKg) : null,
        freeAbove: r.freeAbove != null ? Number(r.freeAbove) : null,
      })),
    }));
  }
}
