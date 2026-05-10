import { ShippingZoneDatasource, ShippingZonePublic } from '../../datasources/shipping-zone.datasource';

export class ListShippingZonesUseCase {
  constructor(private readonly zones: ShippingZoneDatasource) {}

  execute(): Promise<ShippingZonePublic[]> {
    return this.zones.findAllPublic();
  }
}
