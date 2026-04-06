import { RenewTokenUseCase } from './renew-token.use-case';
import { UserEntity, Role } from '../../entities';
import { AuthRepository } from '../../repositories';
import { JwtService } from '../../services';

// --- Helpers -----------------------------------------------------------------

const makeUser = (isActive = true): UserEntity =>
  new UserEntity(
    'user-id-1',
    'Test User',
    'test@example.com',
    'hashed-password',
    Role.SELLER,
    isActive,
    new Date(),
    new Date(),
  );

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

describe('RenewTokenUseCase', () => {
  let useCase: RenewTokenUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new RenewTokenUseCase(mockRepository, mockJwtService);
  });

  describe('cuando el usuario no existe', () => {
    it('lanza CustomError 401', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(useCase.execute('user-id-1')).rejects.toMatchObject({
        statusCode: 401,
        message: 'Usuario no encontrado o inactivo',
      });
    });
  });

  describe('cuando el usuario está inactivo', () => {
    it('lanza CustomError 401', async () => {
      mockRepository.findById.mockResolvedValue(makeUser(false));

      await expect(useCase.execute('user-id-1')).rejects.toMatchObject({
        statusCode: 401,
        message: 'Usuario no encontrado o inactivo',
      });
    });
  });

  describe('cuando el usuario existe y está activo', () => {
    it('retorna un nuevo token y datos del usuario', async () => {
      mockRepository.findById.mockResolvedValue(makeUser());
      mockJwtService.generateToken.mockResolvedValue('new-jwt-token');

      const result = await useCase.execute('user-id-1');

      expect(result).toEqual({
        token: 'new-jwt-token',
        user: {
          id: 'user-id-1',
          name: 'Test User',
          email: 'test@example.com',
          role: Role.SELLER,
        },
      });
    });

    it('genera el token con id y role del usuario', async () => {
      mockRepository.findById.mockResolvedValue(makeUser());
      mockJwtService.generateToken.mockResolvedValue('new-jwt-token');

      await useCase.execute('user-id-1');

      expect(mockJwtService.generateToken).toHaveBeenCalledWith({
        id: 'user-id-1',
        role: Role.SELLER,
      });
    });

    it('no expone el password en la respuesta', async () => {
      mockRepository.findById.mockResolvedValue(makeUser());
      mockJwtService.generateToken.mockResolvedValue('new-jwt-token');

      const result = await useCase.execute('user-id-1');

      expect(result.user).not.toHaveProperty('password');
    });
  });
});
