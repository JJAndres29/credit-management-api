import bcryptjs from 'bcryptjs';
import { LoginUseCase } from './login.use-case';
import { CustomError } from '../../errors';
import { LoginDto } from '../../dtos/auth';
import { UserEntity, Role } from '../../entities';
import { AuthRepository } from '../../repositories';
import { JwtService } from '../../services';

// --- Helpers -----------------------------------------------------------------

const hashedPassword = bcryptjs.hashSync('password123', 10);

const makeUser = (): UserEntity =>
  new UserEntity(
    'user-id-1',
    'Test User',
    'test@example.com',
    hashedPassword,
    Role.ADMIN,
    true,
    new Date(),
    new Date(),
  );

const makeDto = (email = 'test@example.com', password = 'password123'): LoginDto =>
  LoginDto.create({ email, password })[1]!;

// --- Mocks -------------------------------------------------------------------

const mockRepository: jest.Mocked<AuthRepository> = {
  findByEmail: jest.fn(),
  findById: jest.fn(),
};

const mockJwtService: jest.Mocked<JwtService> = {
  generateToken: jest.fn(),
  verifyToken: jest.fn(),
};

// --- Tests -------------------------------------------------------------------

describe('LoginUseCase', () => {
  let useCase: LoginUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new LoginUseCase(mockRepository, mockJwtService);
  });

  describe('cuando el usuario no existe', () => {
    it('lanza CustomError 401 con mensaje genérico', async () => {
      mockRepository.findByEmail.mockResolvedValue(null);

      await expect(useCase.execute(makeDto())).rejects.toMatchObject({
        statusCode: 401,
        message: 'Credenciales inválidas',
      });
    });
  });

  describe('cuando el usuario está inactivo', () => {
    it('lanza CustomError 401 con mensaje genérico', async () => {
      const inactiveUser = new UserEntity(
        'user-id-1', 'Test User', 'test@example.com',
        hashedPassword, Role.ADMIN, false, new Date(), new Date(),
      );
      mockRepository.findByEmail.mockResolvedValue(inactiveUser);

      await expect(useCase.execute(makeDto())).rejects.toMatchObject({
        statusCode: 401,
        message: 'Credenciales inválidas',
      });
    });
  });

  describe('cuando la contraseña es incorrecta', () => {
    it('lanza CustomError 401 con mensaje genérico', async () => {
      mockRepository.findByEmail.mockResolvedValue(makeUser());

      await expect(useCase.execute(makeDto('test@example.com', 'wrong-password'))).rejects.toMatchObject({
        statusCode: 401,
        message: 'Credenciales inválidas',
      });
    });

    it('el mensaje es idéntico al de usuario no encontrado (no revela si el email existe)', async () => {
      mockRepository.findByEmail.mockResolvedValue(null);
      const errorNoUser = await useCase.execute(makeDto()).catch((e: CustomError) => e);

      mockRepository.findByEmail.mockResolvedValue(makeUser());
      const errorWrongPassword = await useCase.execute(makeDto('test@example.com', 'wrong-password')).catch((e: CustomError) => e);

      expect((errorNoUser as CustomError).message).toBe((errorWrongPassword as CustomError).message);
    });
  });

  describe('cuando las credenciales son correctas', () => {
    it('retorna token y datos del usuario', async () => {
      mockRepository.findByEmail.mockResolvedValue(makeUser());
      mockJwtService.generateToken.mockResolvedValue('jwt-token-123');

      const result = await useCase.execute(makeDto());

      expect(result).toEqual({
        token: 'jwt-token-123',
        user: {
          id: 'user-id-1',
          name: 'Test User',
          email: 'test@example.com',
          role: Role.ADMIN,
        },
      });
    });

    it('genera el token con id y role del usuario', async () => {
      mockRepository.findByEmail.mockResolvedValue(makeUser());
      mockJwtService.generateToken.mockResolvedValue('jwt-token-123');

      await useCase.execute(makeDto());

      expect(mockJwtService.generateToken).toHaveBeenCalledWith({
        id: 'user-id-1',
        role: Role.ADMIN,
      });
    });

    it('no expone el password en la respuesta', async () => {
      mockRepository.findByEmail.mockResolvedValue(makeUser());
      mockJwtService.generateToken.mockResolvedValue('jwt-token-123');

      const result = await useCase.execute(makeDto());

      expect(result.user).not.toHaveProperty('password');
    });
  });
});
