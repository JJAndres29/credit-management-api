import { ClaimClientUseCase } from './claim-client.use-case';
import { ClaimClientDto } from '../../dtos/customer-auth';
import { CustomerRepository } from '../../repositories';
import { ClientLookupPort, ClientSummary } from '../../services/client-lookup.port';

// --- Helpers -----------------------------------------------------------------

const makeDto = (overrides: Partial<Record<string, unknown>> = {}): ClaimClientDto =>
  ClaimClientDto.create({ documentType: 'CC', documentNumber: '12345678', ...overrides })[1]!;

const makeClientSummary = (overrides: Partial<ClientSummary> = {}): ClientSummary => ({
  id: 'client-id-1',
  creditLimit: 5000,
  balance: 200,
  isLinkedToCustomer: false,
  ...overrides,
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

// --- DTO validation tests ----------------------------------------------------

describe('ClaimClientDto.create()', () => {
  it('rechaza documentType inválido', () => {
    const [error] = ClaimClientDto.create({ documentType: 'PASSPORT', documentNumber: '123' });
    expect(error).toMatch(/documentType/i);
  });

  it('rechaza documentNumber vacío', () => {
    const [error] = ClaimClientDto.create({ documentType: 'CC', documentNumber: '  ' });
    expect(error).toMatch(/documentNumber/i);
  });

  it('rechaza documentType ausente', () => {
    const [error] = ClaimClientDto.create({ documentNumber: '123' });
    expect(error).toMatch(/documentType/i);
  });

  it('crea DTO válido y hace trim de documentNumber', () => {
    const [error, dto] = ClaimClientDto.create({ documentType: 'CE', documentNumber: '  99887766  ' });
    expect(error).toBeUndefined();
    expect(dto?.documentNumber).toBe('99887766');
    expect(dto?.documentType).toBe('CE');
  });
});

// --- Use Case tests ----------------------------------------------------------

describe('ClaimClientUseCase', () => {
  const CUSTOMER_ID = 'cust-id-1';
  let useCase: ClaimClientUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new ClaimClientUseCase(mockCustomerRepo, mockClientLookup);
  });

  describe('cliente no encontrado', () => {
    it('lanza 404 si findByDocument retorna null', async () => {
      mockClientLookup.findByDocument.mockResolvedValue(null);

      await expect(useCase.execute(CUSTOMER_ID, makeDto())).rejects.toMatchObject({
        statusCode: 404,
      });
      expect(mockCustomerRepo.linkToClient).not.toHaveBeenCalled();
    });
  });

  describe('cliente ya vinculado a otro customer', () => {
    it('lanza 409 si isLinkedToCustomer es true', async () => {
      mockClientLookup.findByDocument.mockResolvedValue(makeClientSummary({ isLinkedToCustomer: true }));

      await expect(useCase.execute(CUSTOMER_ID, makeDto())).rejects.toMatchObject({
        statusCode: 409,
      });
      expect(mockCustomerRepo.linkToClient).not.toHaveBeenCalled();
    });
  });

  describe('vinculación exitosa', () => {
    it('llama linkToClient con customerId y clientId correctos', async () => {
      mockClientLookup.findByDocument.mockResolvedValue(makeClientSummary());
      mockCustomerRepo.linkToClient.mockResolvedValue({} as never);

      await useCase.execute(CUSTOMER_ID, makeDto());

      expect(mockCustomerRepo.linkToClient).toHaveBeenCalledWith(CUSTOMER_ID, 'client-id-1');
    });

    it('retorna ClientSummary con isLinkedToCustomer: true', async () => {
      const summary = makeClientSummary();
      mockClientLookup.findByDocument.mockResolvedValue(summary);
      mockCustomerRepo.linkToClient.mockResolvedValue({} as never);

      const result = await useCase.execute(CUSTOMER_ID, makeDto());

      expect(result).toEqual({ ...summary, isLinkedToCustomer: true });
    });

    it('retorna creditLimit y balance del cliente', async () => {
      mockClientLookup.findByDocument.mockResolvedValue(makeClientSummary({ creditLimit: 10000, balance: 750 }));
      mockCustomerRepo.linkToClient.mockResolvedValue({} as never);

      const result = await useCase.execute(CUSTOMER_ID, makeDto());

      expect(result.creditLimit).toBe(10000);
      expect(result.balance).toBe(750);
    });
  });
});
