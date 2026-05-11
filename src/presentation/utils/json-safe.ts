/**
 * Express `res.json` cannot serialize bigint / Prisma.Decimal — normalize for API output.
 */
export function toJsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, v) => {
      if (typeof v === 'bigint') return Number(v);
      if (v !== null && typeof v === 'object' && typeof (v as { toFixed?: unknown }).toFixed === 'function') {
        return String(v);
      }
      return v;
    }),
  ) as T;
}
