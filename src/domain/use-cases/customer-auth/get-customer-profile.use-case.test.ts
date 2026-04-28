import { GetCustomerProfileUseCase } from './get-customer-profile.use-case';
import { CustomerRepository } from '../../repositories';
import { ClientLookupPort, ClientSummary } from '../../services/client-lookup.port';
import { CustomerEntity } from '../../entities';

// --- Helpers -----------------------------------------------------------------

const makeCustomer = (overrides: Partial<{ clientId: string | null; isActive: boolean }> = {}): CustomerEntity =>
  new CustomerEntity(
    'cust-id-1',
    'Ana García',
    'ana@example.com',
    '+573001234567',
    'hashed-password',
    null,
    overrides.isActive ?? true,
    overrides.clientId ?? null,
    false,
    null,
    new Date(),
    new Date(),
  );

const makeClientSummary = (): ClientSummary => ({
  id: 'client-id-1',
  creditLimit: 5000,
  balance: 200,
  isLinkedToCustomer: true,
});

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

const mockClientLookup: jest.Mocked<ClientLookupPort> = {
  findByDocument: jest.fn(),
  findById: jest.fn(),
};

// --- Use Case tests ----------------------------------------------------------

describe('GetCustomerProfileUseCase', () => {
  let useCase: GetCustomerProfileUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new GetCustomerProfileUseCase(mockCustomerRepo, mockClientLookup);
  });

  describe('customer sin clientId vinculado', () => {
    it('retorna client: null si clientId es null', async () => {
      mockCustomerRepo.findById.mockResolvedValue(makeCustomer({ clientId: null }));

      const result = await useCase.execute('cust-id-1');

      expect(result.client).toBeNull();
      expect(mockClientLookup.findById).not.toHaveBeenCalled();
    });

    it('incluye los datos del customer en la respuesta', async () => {
      mockCustomerRepo.findById.mockResolvedValue(makeCustomer());

      const result = await useCase.execute('cust-id-1');

      expect(result.customer).toMatchObject({ id: 'cust-id-1', name: 'Ana García', email: 'ana@example.com' });
    });

    it('no expone el password en customer', async () => {
      mockCustomerRepo.findById.mockResolvedValue(makeCustomer());

      const result = await useCase.execute('cust-id-1');

      expect(result.customer).not.toHaveProperty('password');
    });
  });

  describe('customer con clientId vinculado', () => {
    it('llama clientLookupPort.findById con el clientId del customer', async () => {
      mockCustomerRepo.findById.mockResolvedValue(makeCustomer({ clientId: 'client-id-1' }));
      mockClientLookup.findById.mockResolvedValue(makeClientSummary());

      await useCase.execute('cust-id-1');

      expect(mockClientLookup.findById).toHaveBeenCalledWith('client-id-1');
    });

    it('retorna el ClientSummary del port', async () => {
      const summary = makeClientSummary();
      mockCustomerRepo.findById.mockResolvedValue(makeCustomer({ clientId: 'client-id-1' }));
      mockClientLookup.findById.mockResolvedValue(summary);

      const result = await useCase.execute('cust-id-1');

      expect(result.client).toEqual(summary);
    });
  });

  describe('customer no encontrado o inactivo', () => {
    it('lanza 401 si findById retorna null', async () => {
      mockCustomerRepo.findById.mockResolvedValue(null);

      await expect(useCase.execute('cust-id-1')).rejects.toMatchObject({ statusCode: 401 });
    });

    it('lanza 401 si el customer está inactivo', async () => {
      mockCustomerRepo.findById.mockResolvedValue(makeCustomer({ isActive: false }));

      await expect(useCase.execute('cust-id-1')).rejects.toMatchObject({ statusCode: 401 });
    });
  });
});
