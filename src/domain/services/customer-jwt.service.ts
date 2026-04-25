export interface CustomerJwtService {
  generateToken(payload: Record<string, unknown>, expiresIn?: string): Promise<string>;
  verifyToken<T>(token: string): Promise<T | null>;
}
