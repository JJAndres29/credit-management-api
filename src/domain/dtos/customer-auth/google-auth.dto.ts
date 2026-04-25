export class GoogleAuthDto {
  private constructor(public readonly idToken: string) {}

  static create(object: Record<string, unknown>): [string?, GoogleAuthDto?] {
    const { idToken } = object;

    if (!idToken || typeof idToken !== 'string' || idToken.trim().length === 0) {
      return ['idToken is required'];
    }

    return [undefined, new GoogleAuthDto(idToken.trim())];
  }
}
