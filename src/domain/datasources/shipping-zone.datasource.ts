export type ShippingRatePublic = {
  id: string;
  code: string;
  baseFee: number;
  perKg: number | null;
  freeAbove: number | null;
};

export type ShippingZonePublic = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  rates: ShippingRatePublic[];
};

export interface ShippingZoneDatasource {
  findAllPublic(): Promise<ShippingZonePublic[]>;
}
