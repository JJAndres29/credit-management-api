import jwt from 'jsonwebtoken';
import { envs } from '../../config/envs';
import { CustomerJwtService } from '../../domain/services';
import { CustomError } from '../../domain/errors';

export class CustomerJwtAdapter implements CustomerJwtService {
  async generateToken(
    payload: Record<string, unknown>,
    expiresIn: string = envs.jwtCustomerExpiresIn,
  ): Promise<string> {
    if (!envs.jwtCustomerSecret) {
      throw CustomError.internalServer('Customer auth not configured (JWT_CUSTOMER_SECRET missing)');
    }
    return new Promise((resolve, reject) => {
      jwt.sign(
        payload,
        envs.jwtCustomerSecret,
        { expiresIn, audience: 'customer' } as jwt.SignOptions,
        (err, token) => {
          if (err || !token) return reject(err ?? new Error('Token generation failed'));
          resolve(token);
        },
      );
    });
  }

  async verifyToken<T>(token: string): Promise<T | null> {
    if (!envs.jwtCustomerSecret) return null;
    return new Promise((resolve) => {
      jwt.verify(token, envs.jwtCustomerSecret, { audience: 'customer' }, (err, decoded) => {
        if (err) return resolve(null);
        resolve(decoded as T);
      });
    });
  }
}
