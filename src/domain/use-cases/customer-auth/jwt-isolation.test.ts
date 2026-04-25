/**
 * Verifica que los tokens de Customer y los de Staff (User) son mutuamente inválidos.
 *
 * CustomerJwtAdapter: firma con JWT_CUSTOMER_SECRET + audience:'customer'
 * JwtAdapter (staff):  firma con JWT_SECRET (sin audience)
 *
 * Un token de customer NO debe ser aceptado por el adapter de staff y viceversa.
 */

const STAFF_SECRET = 'staff-secret-32chars-xxxxxxxxxxx';
const CUSTOMER_SECRET = 'customer-secret-32chars-xxxxxxxxx';

jest.mock('../../../config/envs', () => ({
  envs: {
    jwtSecret: STAFF_SECRET,
    jwtExpiresIn: '1h',
    jwtCustomerSecret: CUSTOMER_SECRET,
    jwtCustomerExpiresIn: '1h',
  },
}));

import { JwtAdapter } from '../../../infrastructure/services/jwt.adapter';
import { CustomerJwtAdapter } from '../../../infrastructure/services/customer-jwt.adapter';

describe('JWT Isolation — Staff vs Customer tokens', () => {
  describe('token de customer rechazado por adapter de staff', () => {
    it('verifyToken devuelve null para un token firmado por CustomerJwtAdapter', async () => {
      const customerAdapter = new CustomerJwtAdapter();
      const staffAdapter = new JwtAdapter();

      const customerToken = await customerAdapter.generateToken({ id: 'cust-1' });
      const result = await staffAdapter.verifyToken(customerToken);

      expect(result).toBeNull();
    });
  });

  describe('token de staff rechazado por adapter de customer', () => {
    it('verifyToken devuelve null para un token firmado por JwtAdapter', async () => {
      const staffAdapter = new JwtAdapter();
      const customerAdapter = new CustomerJwtAdapter();

      const staffToken = await staffAdapter.generateToken({ id: 'user-1', role: 'ADMIN' });
      const result = await customerAdapter.verifyToken(staffToken);

      expect(result).toBeNull();
    });
  });

  describe('cada adapter acepta su propio token', () => {
    it('CustomerJwtAdapter acepta tokens que él mismo firmó', async () => {
      const adapter = new CustomerJwtAdapter();
      const token = await adapter.generateToken({ id: 'cust-1' });
      const payload = await adapter.verifyToken<{ id: string }>(token);

      expect(payload).not.toBeNull();
      expect(payload!.id).toBe('cust-1');
    });

    it('JwtAdapter (staff) acepta tokens que él mismo firmó', async () => {
      const adapter = new JwtAdapter();
      const token = await adapter.generateToken({ id: 'user-1', role: 'ADMIN' });
      const payload = await adapter.verifyToken<{ id: string; role: string }>(token);

      expect(payload).not.toBeNull();
      expect(payload!.id).toBe('user-1');
    });
  });
});

describe('CustomerJwtAdapter — sin secret configurado', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('generateToken lanza CustomError 500 si JWT_CUSTOMER_SECRET está vacío', async () => {
    jest.mock('../../../config/envs', () => ({
      envs: {
        jwtSecret: STAFF_SECRET,
        jwtExpiresIn: '1h',
        jwtCustomerSecret: '',
        jwtCustomerExpiresIn: '1h',
      },
    }));

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { CustomerJwtAdapter: Adapter } = require('../../../infrastructure/services/customer-jwt.adapter');
    const adapter = new Adapter();

    await expect(adapter.generateToken({ id: 'x' })).rejects.toMatchObject({ statusCode: 500 });
  });

  it('verifyToken devuelve null si JWT_CUSTOMER_SECRET está vacío', async () => {
    jest.mock('../../../config/envs', () => ({
      envs: {
        jwtSecret: STAFF_SECRET,
        jwtExpiresIn: '1h',
        jwtCustomerSecret: '',
        jwtCustomerExpiresIn: '1h',
      },
    }));

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { CustomerJwtAdapter: Adapter } = require('../../../infrastructure/services/customer-jwt.adapter');
    const adapter = new Adapter();

    expect(await adapter.verifyToken('some-token')).toBeNull();
  });
});
