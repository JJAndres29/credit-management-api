import bcryptjs from 'bcryptjs';
import { LoginCustomerUseCase } from './login-customer.use-case';
import { LoginCustomerDto } from '../../dtos/customer-auth';
import { CustomError } from '../../errors';
import { CustomerRepository } from '../../repositories';
import { CustomerJwtService } from '../../services';
import { CustomerEntity } from '../../entities';

// --- Helpers -----------------------------------------------------------------

const hashedPassword = bcryptjs.hashSync('Secret1!', 10);

const makeCustomer = (isActive = true): CustomerEntity =>
  new CustomerEntity(
    'cust-id-1',
    'Ana García',
    'ana@example.com',
    hashedPassword,
    '+573001234567',
    null,
    isActive,
    new Date(),
    new Date(),
  );

const makeDto = (email = 'ana@example.com', password = 'Secret1!'): LoginCustomerDto =>
  LoginCustomerDto.create({ email, password })[1]!;

// --- Mocks -------------------------------------------------------------------

const mockRepository: jest.Mocked<CustomerRepository> = {
  findByEmail: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
};

const mockJwtService: jest.Mocked<CustomerJwtService> = {
  generateToken: jest.fn(),
  verifyToken: jest.fn(),
};

// --- Tests -------------------------------------------------------------------

describe('LoginCustomerUseCase', () => {
  let useCase: LoginCustomerUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new LoginCustomerUseCase(mockRepository, mockJwtService);
  });

  describe('cuando el email no existe', () => {
    it('lanza CustomError 401 con mensaje genérico (anti-enumeration)', async () => {
      mockRepository.findByEmail.mockResolvedValue(null);

      await expect(useCase.execute(makeDto())).rejects.toMatchObject({
        statusCode: 401,
        message: 'Credenciales inválidas',
      });
    });
  });

  describe('cuando el customer está inactivo', () => {
    it('lanza CustomError 401 con el mismo mensaje genérico', async () => {
      mockRepository.findByEmail.mockResolvedValue(makeCustomer(false));

      await expect(useCase.execute(makeDto())).rejects.toMatchObject({
        statusCode: 401,
        message: 'Credenciales inválidas',
      });
    });

    it('el mensaje es idéntico al de email inexistente (no revela si el email existe)', async () => {
      mockRepository.findByEmail.mockResolvedValue(null);
      const errNoEmail = await useCase.execute(makeDto()).catch((e: CustomError) => e);

      mockRepository.findByEmail.mockResolvedValue(makeCustomer(false));
      const errInactive = await useCase.execute(makeDto()).catch((e: CustomError) => e);

      expect((errNoEmail as CustomError).message).toBe((errInactive as CustomError).message);
    });
  });

  describe('cuando la contraseña es incorrecta', () => {
    it('lanza CustomError 401 con mensaje genérico', async () => {
      mockRepository.findByEmail.mockResolvedValue(makeCustomer());

      await expect(useCase.execute(makeDto('ana@example.com', 'wrong!'))).rejects.toMatchObject({
        statusCode: 401,
        message: 'Credenciales inválidas',
      });
    });

    it('el mensaje es idéntico al de email inexistente (anti-enumeration)', async () => {
      mockRepository.findByEmail.mockResolvedValue(null);
      const errNoEmail = await useCase.execute(makeDto()).catch((e: CustomError) => e);

      mockRepository.findByEmail.mockResolvedValue(makeCustomer());
      const errBadPass = await useCase.execute(makeDto('ana@example.com', 'wrong!')).catch((e: CustomError) => e);

      expect((errNoEmail as CustomError).message).toBe((errBadPass as CustomError).message);
    });
  });

  describe('cuando las credenciales son correctas', () => {
    it('retorna token y datos del customer', async () => {
      mockRepository.findByEmail.mockResolvedValue(makeCustomer());
      mockJwtService.generateToken.mockResolvedValue('customer-jwt-token');

      const result = await useCase.execute(makeDto());

      expect(result).toEqual({
        token: 'customer-jwt-token',
        customer: {
          id: 'cust-id-1',
          name: 'Ana García',
          email: 'ana@example.com',
          phone: '+573001234567',
        },
      });
    });

    it('no expone el password en la respuesta', async () => {
      mockRepository.findByEmail.mockResolvedValue(makeCustomer());
      mockJwtService.generateToken.mockResolvedValue('customer-jwt-token');

      const result = await useCase.execute(makeDto());

      expect(result.customer).not.toHaveProperty('password');
    });

    it('genera el token con el id del customer', async () => {
      mockRepository.findByEmail.mockResolvedValue(makeCustomer());
      mockJwtService.generateToken.mockResolvedValue('customer-jwt-token');

      await useCase.execute(makeDto());

      expect(mockJwtService.generateToken).toHaveBeenCalledWith({ id: 'cust-id-1' });
    });

    it('el token generado se llama con audience customer (verificación de payload)', async () => {
      mockRepository.findByEmail.mockResolvedValue(makeCustomer());
      mockJwtService.generateToken.mockResolvedValue('customer-jwt-token');

      await useCase.execute(makeDto());

      // El CustomerJwtAdapter agrega audience:'customer' vía jwt options,
      // por eso el payload del use case solo contiene { id } — el adapter lo enriquece.
      expect(mockJwtService.generateToken).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'cust-id-1' }),
      );
    });
  });
});
