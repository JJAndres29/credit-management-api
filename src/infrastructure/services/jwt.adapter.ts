import jwt from 'jsonwebtoken';
import { envs } from '../../config/envs';
import { JwtService } from '../../domain/services';

export class JwtAdapter implements JwtService {
  async generateToken(
    payload: Record<string, unknown>,
    expiresIn: string = envs.jwtExpiresIn,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      jwt.sign(payload, envs.jwtSecret, { expiresIn } as jwt.SignOptions, (err, token) => {
        if (err || !token) return reject(err ?? new Error('Token generation failed'));
        resolve(token);
      });
    });
  }

  async verifyToken<T>(token: string): Promise<T | null> {
    return new Promise((resolve) => {
      jwt.verify(token, envs.jwtSecret, (err, decoded) => {
        if (err) return resolve(null);
        resolve(decoded as T);
      });
    });
  }
}
