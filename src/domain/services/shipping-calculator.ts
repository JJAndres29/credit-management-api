/** Pure helper — unit-test friendly regardless of DB rate rows */
export function computeShippingFeeCop(params: {
  baseFee: number;
  perKg: number | null;
  weightKg: number;
  freeAbove: number | null;
  merchandiseSubtotalCop: number;
}): number {
  let fee = params.baseFee;
  if (params.perKg != null && params.weightKg > 0) {
    fee += params.perKg * params.weightKg;
  }
  fee = Math.round(fee * 100) / 100;
  if (params.freeAbove != null && params.merchandiseSubtotalCop >= params.freeAbove) {
    return 0;
  }
  return fee;
}
