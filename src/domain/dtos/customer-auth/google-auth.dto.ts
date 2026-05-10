export class GoogleAuthDto {
  private constructor(
    public readonly idToken: string,
    public readonly mergeCartSessionToken: string | null,
  ) {}

  static create(object: Record<string, unknown>): [string?, GoogleAuthDto?] {
    const { idToken, mergeCartSessionToken } = object;

    if (!idToken || typeof idToken !== 'string' || idToken.trim().length === 0) {
      return ['idToken is required'];
    }

    let mergeTok: string | null = null;
    if (mergeCartSessionToken !== undefined && mergeCartSessionToken !== null) {
      if (typeof mergeCartSessionToken !== 'string') return ['mergeCartSessionToken debe ser texto'];
      const t = mergeCartSessionToken.trim();
      if (t.length > 0 && t.length < 8) return ['mergeCartSessionToken inválido'];
      mergeTok = t.length >= 8 ? t : null;
    }

    return [undefined, new GoogleAuthDto(idToken.trim(), mergeTok)];
  }
}
