import { GoogleAuthUseCase } from './google-auth.use-case';
import { GoogleAuthDto } from '../../dtos/customer-auth';
import { CustomerRepository } from '../../repositories';
import { CustomerJwtService } from '../../services';
import { CustomerEntity } from '../../entities';

// --- Helpers -----------------------------------------------------------------

const makeCustomer = (overrides: Partial<{ isActive: boolean }> = {}): CustomerEntity =>
  new CustomerEntity(
    'cust-id-1',
    'Ana García',
    'ana@example.com',
    '',
    null,
    'google-sub-123',
    overrides.isActive ?? true,
    null,
    false,
    new Date(),
    new Date(),
  );

const makeDto = (): GoogleAuthDto =>
  GoogleAuthDto.create({ idToken: 'valid-google-token' })[1]!;

// --- Mocks -------------------------------------------------------------------

const mockCustomerRepo: jest.Mocked<CustomerRepository> = {
  findAll: jest.fn(),
  findByEmail: jest.fn(),
  findById: jest.fn(),
  findByGoogleId: jest.fn(),
  findByClientId: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  linkToClient: jest.fn(),
};

const mockJwtService: jest.Mocked<CustomerJwtService> = {
  generateToken: jest.fn(),
  verifyToken: jest.fn(),
};

// Partial mock of google-auth-library — we stub verifyIdToken at the module level
jest.mock('google-auth-library', () => {
  return {
    OAuth2Client: jest.fn().mockImplementation(() => ({
      verifyIdToken: jest.fn().mockResolvedValue({
        getPayload: () => ({
          sub: 'google-sub-123',
          email: 'ana@example.com',
          name: 'Ana García',
        }),
      }),
    })),
  };
});

// --- DTO validation tests ----------------------------------------------------

describe('GoogleAuthDto.create()', () => {
  it('rechaza idToken vacío', () => {
    const [error] = GoogleAuthDto.create({ idToken: '  ' });
    expect(error).toMatch(/idToken/i);
  });

  it('rechaza idToken ausente', () => {
    const [error] = GoogleAuthDto.create({});
    expect(error).toMatch(/idToken/i);
  });

  it('crea DTO válido con trim', () => {
    const [error, dto] = GoogleAuthDto.create({ idToken: '  token123  ' });
    expect(error).toBeUndefined();
    expect(dto?.idToken).toBe('token123');
  });
});

// --- Use Case tests ----------------------------------------------------------

describe('GoogleAuthUseCase', () => {
  let useCase: GoogleAuthUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new GoogleAuthUseCase(mockCustomerRepo, mockJwtService, 'test-google-client-id');
  });

  describe('sin GOOGLE_CLIENT_ID configurado', () => {
    it('lanza 500 si googleClientId está vacío', async () => {
      const ucNoConfig = new GoogleAuthUseCase(mockCustomerRepo, mockJwtService, '');
      await expect(ucNoConfig.execute(makeDto())).rejects.toMatchObject({ statusCode: 500 });
    });
  });

  describe('customer existente por googleId', () => {
    it('no crea nuevo customer si ya existe', async () => {
      mockCustomerRepo.findByGoogleId.mockResolvedValue(makeCustomer());
      mockJwtService.generateToken.mockResolvedValue('jwt-token');

      await useCase.execute(makeDto());

      expect(mockCustomerRepo.create).not.toHaveBeenCalled();
    });

    it('retorna token y customer', async () => {
      mockCustomerRepo.findByGoogleId.mockResolvedValue(makeCustomer());
      mockJwtService.generateToken.mockResolvedValue('jwt-token');

      const result = await useCase.execute(makeDto());

      expect(result.token).toBe('jwt-token');
      expect(result.customer).toMatchObject({ id: 'cust-id-1', email: 'ana@example.com' });
    });
  });

  describe('customer nuevo (primer login)', () => {
    it('crea customer con datos de Google si no existe', async () => {
      mockCustomerRepo.findByGoogleId.mockResolvedValue(null);
      mockCustomerRepo.create.mockResolvedValue(makeCustomer());
      mockJwtService.generateToken.mockResolvedValue('jwt-token');

      await useCase.execute(makeDto());

      expect(mockCustomerRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ googleId: 'google-sub-123', email: 'ana@example.com', name: 'Ana García' }),
      );
    });

    it('retorna token y customer recién creado', async () => {
      mockCustomerRepo.findByGoogleId.mockResolvedValue(null);
      mockCustomerRepo.create.mockResolvedValue(makeCustomer());
      mockJwtService.generateToken.mockResolvedValue('jwt-token');

      const result = await useCase.execute(makeDto());

      expect(result).toMatchObject({ token: 'jwt-token' });
    });
  });

  describe('customer inactivo', () => {
    it('lanza 401 si el customer está inactivo', async () => {
      mockCustomerRepo.findByGoogleId.mockResolvedValue(makeCustomer({ isActive: false }));

      await expect(useCase.execute(makeDto())).rejects.toMatchObject({ statusCode: 401 });
    });
  });

  describe('genera token con id del customer', () => {
    it('llama generateToken con el id del customer', async () => {
      mockCustomerRepo.findByGoogleId.mockResolvedValue(makeCustomer());
      mockJwtService.generateToken.mockResolvedValue('jwt-token');

      await useCase.execute(makeDto());

      expect(mockJwtService.generateToken).toHaveBeenCalledWith({ id: 'cust-id-1' });
    });
  });
});
