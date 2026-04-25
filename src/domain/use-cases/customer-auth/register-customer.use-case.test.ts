import bcryptjs from 'bcryptjs';
import { RegisterCustomerUseCase } from './register-customer.use-case';
import { RegisterCustomerDto } from '../../dtos/customer-auth';
import { CustomError } from '../../errors';
import { CustomerRepository } from '../../repositories';
import { CustomerJwtService } from '../../services';
import { CustomerEntity } from '../../entities';

// --- Helpers -----------------------------------------------------------------

const makeCustomer = (): CustomerEntity =>
  new CustomerEntity(
    'cust-id-1',
    'Ana García',
    'ana@example.com',
    '+573001234567',
    bcryptjs.hashSync('Secret1!', 10),
    null,
    true,
    null,
    false,
    new Date(),
    new Date(),
  );

const makeDto = (overrides: Partial<Record<string, unknown>> = {}): RegisterCustomerDto =>
  RegisterCustomerDto.create({
    name: 'Ana García',
    email: 'ana@example.com',
    password: 'Secret1!',
    phone: '+573001234567',
    ...overrides,
  })[1]!;

// --- Mocks -------------------------------------------------------------------

const mockRepository: jest.Mocked<CustomerRepository> = {
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

// --- DTO validation tests ----------------------------------------------------

describe('RegisterCustomerDto.create()', () => {
  it('rechaza password débil (sin mayúscula)', () => {
    const [error] = RegisterCustomerDto.create({
      name: 'Ana García',
      email: 'ana@example.com',
      password: 'secret1!',
      phone: '+573001234567',
    });
    expect(error).toMatch(/password/i);
  });

  it('rechaza password débil (muy corta)', () => {
    const [error] = RegisterCustomerDto.create({
      name: 'Ana García',
      email: 'ana@example.com',
      password: 'Ab1!',
      phone: '+573001234567',
    });
    expect(error).toMatch(/password/i);
  });

  it('rechaza email inválido', () => {
    const [error] = RegisterCustomerDto.create({
      name: 'Ana García',
      email: 'not-an-email',
      password: 'Secret1!',
      phone: '+573001234567',
    });
    expect(error).toMatch(/email/i);
  });

  it('crea DTO con datos válidos', () => {
    const [error, dto] = RegisterCustomerDto.create({
      name: 'Ana García',
      email: 'ANA@EXAMPLE.COM',
      password: 'Secret1!',
      phone: '+573001234567',
    });
    expect(error).toBeUndefined();
    expect(dto?.email).toBe('ana@example.com');
  });
});

// --- Use Case tests ----------------------------------------------------------

describe('RegisterCustomerUseCase', () => {
  let useCase: RegisterCustomerUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new RegisterCustomerUseCase(mockRepository, mockJwtService);
  });

  describe('cuando el email ya está registrado', () => {
    it('lanza CustomError 409 Conflict', async () => {
      mockRepository.findByEmail.mockResolvedValue(makeCustomer());

      await expect(useCase.execute(makeDto())).rejects.toMatchObject({
        statusCode: 409,
        message: 'El email ya está registrado',
      });
      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('cuando el registro es exitoso', () => {
    it('retorna token y datos del customer', async () => {
      mockRepository.findByEmail.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(makeCustomer());
      mockJwtService.generateToken.mockResolvedValue('customer-jwt-token');

      const result = await useCase.execute(makeDto());

      expect(result).toEqual({
        token: 'customer-jwt-token',
        customer: {
          id: 'cust-id-1',
          name: 'Ana García',
          email: 'ana@example.com',
          phone: '+573001234567',
          mustChangePassword: false,
        },
      });
    });

    it('no expone el password en la respuesta', async () => {
      mockRepository.findByEmail.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(makeCustomer());
      mockJwtService.generateToken.mockResolvedValue('customer-jwt-token');

      const result = await useCase.execute(makeDto());

      expect(result.customer).not.toHaveProperty('password');
    });

    it('hashea el password antes de persistir', async () => {
      mockRepository.findByEmail.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(makeCustomer());
      mockJwtService.generateToken.mockResolvedValue('customer-jwt-token');

      await useCase.execute(makeDto());

      const createCall = mockRepository.create.mock.calls[0][0];
      expect(createCall.password).not.toBe('Secret1!');
      expect(bcryptjs.compareSync('Secret1!', createCall.password as string)).toBe(true);
    });

    it('genera el token con el id del customer', async () => {
      mockRepository.findByEmail.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(makeCustomer());
      mockJwtService.generateToken.mockResolvedValue('customer-jwt-token');

      await useCase.execute(makeDto());

      expect(mockJwtService.generateToken).toHaveBeenCalledWith({ id: 'cust-id-1' });
    });
  });

  describe('error de tipo CustomError propagado', () => {
    it('propaga CustomError del repositorio', async () => {
      mockRepository.findByEmail.mockRejectedValue(CustomError.internalServer('DB down'));

      await expect(useCase.execute(makeDto())).rejects.toMatchObject({ statusCode: 500 });
    });
  });
});
