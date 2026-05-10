/**
 * Colombia-oriented assumption: storefront `unitPrice` is IVA-inclusive (gross).
 * Splits each line into net + tax for persisted breakdown on OnlineOrder.
 */
export const DEFAULT_IVA_PERCENT = 19;

export function resolveIvaPercent(productIva: number | null, categoryIva: number | null): number {
  if (productIva != null && productIva >= 0) return productIva;
  if (categoryIva != null && categoryIva >= 0) return categoryIva;
  return DEFAULT_IVA_PERCENT;
}

export function splitGrossLineIntoNetAndTax(
  grossLine: number,
  ivaPercent: number,
): { net: number; tax: number } {
  if (ivaPercent <= 0) {
    return { net: round2(grossLine), tax: 0 };
  }
  const divisor = 1 + ivaPercent / 100;
  const net = round2(grossLine / divisor);
  const tax = round2(grossLine - net);
  return { net, tax };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
