const MAX_IDS = 20;

export class ReuseProductAssetsDto {
  private constructor(
    public readonly variantId: string,
    public readonly assetIds: string[],
  ) {}

  static create(object: Record<string, unknown>): [string?, ReuseProductAssetsDto?] {
    const { variantId, assetIds } = object;

    if (!variantId || typeof variantId !== 'string' || variantId.trim().length === 0) {
      return ['variantId es requerido'];
    }

    if (!Array.isArray(assetIds) || assetIds.length === 0) {
      return ['assetIds debe ser un arreglo con al menos un id'];
    }

    const parsed: string[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < assetIds.length; i += 1) {
      const id = assetIds[i];
      if (typeof id !== 'string' || id.trim().length === 0) {
        return [`assetIds[${i}] debe ser un string no vacío`];
      }
      const t = id.trim();
      if (seen.has(t)) {
        return ['assetIds no puede contener duplicados'];
      }
      seen.add(t);
      parsed.push(t);
    }

    if (parsed.length > MAX_IDS) {
      return [`Máximo ${MAX_IDS} assets por solicitud`];
    }

    return [undefined, new ReuseProductAssetsDto(variantId.trim(), parsed)];
  }
}
