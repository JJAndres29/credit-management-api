/**
 * Tests — Bloque 1e: GenerateAccountStatementUseCase
 *
 * Sin mocks de infraestructura, sin DB, sin PDFKit.
 * El PdfService se reemplaza con un jest.fn() que retorna un Buffer.
 */

import { GenerateAccountStatementUseCase } from './generate-account-statement.use-case';
import { ClientRepository } from '../../repositories';
import { SaleRepository } from '../../repositories';
import { PaymentRepository } from '../../repositories';
import { ProductRepository } from '../../repositories';
import { PdfService } from '../../services/pdf.service';
import { ClientEntity } from '../../entities/client.entity';
import { PaymentEntity } from '../../entities/payment.entity';
import { SaleEntity, SaleItemEntity, SaleType, SaleStatus } from '../../entities/sale.entity';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeClient(id = 'client-1'): ClientEntity {
  return new ClientEntity(id, 'Carlos Díaz', '555-4321', 'carlos@example.com', 10_000, 500, true, new Date(), new Date());
}

function makeSale(id: string, clientId: string, productIds: string[]): SaleEntity {
  const items = productIds.map((productId, idx) =>
    new SaleItemEntity(
      `item-${id}-${idx}`,
      id,
      productId,
      2,
      100,
      115,
      230,
      'CREDIT_SURCHARGE_15PCT',
    ),
  );
  return new SaleEntity(id, clientId, SaleType.CREDIT, SaleStatus.PENDING, 230, new Date(), items);
}

function makePayment(id: string, clientId: string): PaymentEntity {
  return new PaymentEntity(id, clientId, null, 50, null, new Date());
}

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockClientRepo = {
  findById: jest.fn(),
  findByEmail: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findAll: jest.fn(),
} as jest.Mocked<ClientRepository>;

const mockSaleRepo = {
  create: jest.fn(),
  findById: jest.fn(),
  findAll: jest.fn(),
  findByClientId: jest.fn(),
} as jest.Mocked<SaleRepository>;

const mockPaymentRepo = {
  create: jest.fn(),
  findById: jest.fn(),
  findAll: jest.fn(),
  findByClientId: jest.fn(),
  findBySaleId: jest.fn(),
} as jest.Mocked<PaymentRepository>;

const mockProductRepo = {
  findById: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  adjustStock: jest.fn(),
  delete: jest.fn(),
  addImages: jest.fn(),
  removeImage: jest.fn(),
} as jest.Mocked<ProductRepository>;

const mockPdfService: jest.Mocked<PdfService> = {
  generateAccountStatement: jest.fn(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GenerateAccountStatementUseCase', () => {
  let useCase: GenerateAccountStatementUseCase;
  const fakeBuffer = Buffer.from('fake-pdf-content');

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new GenerateAccountStatementUseCase(
      mockClientRepo,
      mockSaleRepo,
      mockPaymentRepo,
      mockProductRepo,
      mockPdfService,
    );
    mockPdfService.generateAccountStatement.mockResolvedValue(fakeBuffer);
  });

  // ─── Errores de validación ─────────────────────────────────────────────────

  describe('cuando el cliente no existe', () => {
    it('lanza CustomError 404 con el ID del cliente', async () => {
      mockClientRepo.findById.mockResolvedValue(null);

      await expect(useCase.execute('client-999', 'Admin')).rejects.toMatchObject({
        statusCode: 404,
        message: expect.stringContaining('client-999'),
      });
    });

    it('no consulta ventas ni pagos si el cliente no existe', async () => {
      mockClientRepo.findById.mockResolvedValue(null);

      await useCase.execute('client-999', 'Admin').catch(() => {});

      expect(mockSaleRepo.findByClientId).not.toHaveBeenCalled();
      expect(mockPaymentRepo.findByClientId).not.toHaveBeenCalled();
    });
  });

  // ─── Consultas en paralelo ─────────────────────────────────────────────────

  describe('performance: consultas en paralelo', () => {
    it('llama a findByClientId de ventas Y pagos (ambas se ejecutan)', async () => {
      mockClientRepo.findById.mockResolvedValue(makeClient());
      mockSaleRepo.findByClientId.mockResolvedValue([]);
      mockPaymentRepo.findByClientId.mockResolvedValue([]);

      await useCase.execute('client-1', 'Admin');

      expect(mockSaleRepo.findByClientId).toHaveBeenCalledWith('client-1');
      expect(mockPaymentRepo.findByClientId).toHaveBeenCalledWith('client-1');
    });

    it('los repositorios se llaman exactamente una vez cada uno', async () => {
      mockClientRepo.findById.mockResolvedValue(makeClient());
      mockSaleRepo.findByClientId.mockResolvedValue([]);
      mockPaymentRepo.findByClientId.mockResolvedValue([]);

      await useCase.execute('client-1', 'Admin');

      expect(mockSaleRepo.findByClientId).toHaveBeenCalledTimes(1);
      expect(mockPaymentRepo.findByClientId).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Cliente sin ventas ────────────────────────────────────────────────────

  describe('cliente sin ventas ni pagos', () => {
    it('genera el PDF igualmente (retorna Buffer)', async () => {
      mockClientRepo.findById.mockResolvedValue(makeClient());
      mockSaleRepo.findByClientId.mockResolvedValue([]);
      mockPaymentRepo.findByClientId.mockResolvedValue([]);

      const result = await useCase.execute('client-1', 'Admin');

      expect(result).toBe(fakeBuffer);
    });

    it('llama a pdfService con sales y payments arrays vacíos', async () => {
      mockClientRepo.findById.mockResolvedValue(makeClient());
      mockSaleRepo.findByClientId.mockResolvedValue([]);
      mockPaymentRepo.findByClientId.mockResolvedValue([]);

      await useCase.execute('client-1', 'Admin');

      expect(mockPdfService.generateAccountStatement).toHaveBeenCalledWith(
        expect.objectContaining({
          sales: [],
          payments: [],
        }),
      );
    });

    it('no consulta productos si no hay ventas', async () => {
      mockClientRepo.findById.mockResolvedValue(makeClient());
      mockSaleRepo.findByClientId.mockResolvedValue([]);
      mockPaymentRepo.findByClientId.mockResolvedValue([]);

      await useCase.execute('client-1', 'Admin');

      expect(mockProductRepo.findById).not.toHaveBeenCalled();
    });
  });

  // ─── Deduplicación de productos ───────────────────────────────────────────

  describe('deduplicación de productos', () => {
    it('llama a productRepository.findById una sola vez por productId único', async () => {
      // Dos ventas que comparten el mismo producto (prod-A)
      const sale1 = makeSale('sale-1', 'client-1', ['prod-A', 'prod-B']);
      const sale2 = makeSale('sale-2', 'client-1', ['prod-A', 'prod-C']); // prod-A repetido

      mockClientRepo.findById.mockResolvedValue(makeClient());
      mockSaleRepo.findByClientId.mockResolvedValue([sale1, sale2]);
      mockPaymentRepo.findByClientId.mockResolvedValue([]);
      mockProductRepo.findById.mockResolvedValue(null); // retorna null → fallback name

      await useCase.execute('client-1', 'Admin');

      // prod-A aparece en 2 ventas pero findById debe llamarse solo 1 vez para prod-A
      const prodACalls = (mockProductRepo.findById as jest.Mock).mock.calls.filter(
        (c: [string]) => c[0] === 'prod-A',
      );
      expect(prodACalls).toHaveLength(1);
    });

    it('llama a findById una vez por cada productId único (3 únicos de 4 referencias)', async () => {
      const sale1 = makeSale('sale-1', 'client-1', ['prod-A', 'prod-B']);
      const sale2 = makeSale('sale-2', 'client-1', ['prod-A', 'prod-C']); // prod-A duplicado

      mockClientRepo.findById.mockResolvedValue(makeClient());
      mockSaleRepo.findByClientId.mockResolvedValue([sale1, sale2]);
      mockPaymentRepo.findByClientId.mockResolvedValue([]);
      mockProductRepo.findById.mockResolvedValue(null);

      await useCase.execute('client-1', 'Admin');

      // 3 IDs únicos: prod-A, prod-B, prod-C
      expect(mockProductRepo.findById).toHaveBeenCalledTimes(3);
    });

    it('usa el nombre del producto cuando el repositorio lo encuentra', async () => {
      const sale = makeSale('sale-1', 'client-1', ['prod-known']);

      mockClientRepo.findById.mockResolvedValue(makeClient());
      mockSaleRepo.findByClientId.mockResolvedValue([sale]);
      mockPaymentRepo.findByClientId.mockResolvedValue([]);
      mockProductRepo.findById.mockImplementation(async (id: string) => {
        if (id === 'prod-known') {
          return {
            id: 'prod-known',
            name: 'Producto Conocido',
            price: 100,
            stock: 10,
            images: [],
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as any;
        }
        return null;
      });

      await useCase.execute('client-1', 'Admin');

      expect(mockPdfService.generateAccountStatement).toHaveBeenCalledWith(
        expect.objectContaining({
          sales: expect.arrayContaining([
            expect.objectContaining({
              items: expect.arrayContaining([
                expect.objectContaining({ productName: 'Producto Conocido' }),
              ]),
            }),
          ]),
        }),
      );
    });

    it('usa un nombre de fallback cuando el producto no existe en DB', async () => {
      const sale = makeSale('sale-1', 'client-1', ['prod-deleted']);

      mockClientRepo.findById.mockResolvedValue(makeClient());
      mockSaleRepo.findByClientId.mockResolvedValue([sale]);
      mockPaymentRepo.findByClientId.mockResolvedValue([]);
      mockProductRepo.findById.mockResolvedValue(null); // producto eliminado

      await useCase.execute('client-1', 'Admin');

      expect(mockPdfService.generateAccountStatement).toHaveBeenCalledWith(
        expect.objectContaining({
          sales: expect.arrayContaining([
            expect.objectContaining({
              items: expect.arrayContaining([
                expect.objectContaining({
                  productName: expect.stringContaining('prod-del'), // primeros 8 chars del ID
                }),
              ]),
            }),
          ]),
        }),
      );
    });
  });

  // ─── Datos pasados al PdfService ──────────────────────────────────────────

  describe('datos pasados al PdfService', () => {
    it('incluye los datos del cliente correctamente', async () => {
      mockClientRepo.findById.mockResolvedValue(makeClient('client-pdf'));
      mockSaleRepo.findByClientId.mockResolvedValue([]);
      mockPaymentRepo.findByClientId.mockResolvedValue([]);

      await useCase.execute('client-pdf', 'SuperAdmin');

      expect(mockPdfService.generateAccountStatement).toHaveBeenCalledWith(
        expect.objectContaining({
          client: expect.objectContaining({
            id: 'client-pdf',
            name: 'Carlos Díaz',
          }),
        }),
      );
    });

    it('incluye generatedBy con el nombre del usuario que lo solicitó', async () => {
      mockClientRepo.findById.mockResolvedValue(makeClient());
      mockSaleRepo.findByClientId.mockResolvedValue([]);
      mockPaymentRepo.findByClientId.mockResolvedValue([]);

      await useCase.execute('client-1', 'Ana Martínez');

      expect(mockPdfService.generateAccountStatement).toHaveBeenCalledWith(
        expect.objectContaining({ generatedBy: 'Ana Martínez' }),
      );
    });

    it('incluye los pagos del cliente mapeados', async () => {
      mockClientRepo.findById.mockResolvedValue(makeClient());
      mockSaleRepo.findByClientId.mockResolvedValue([]);
      mockPaymentRepo.findByClientId.mockResolvedValue([makePayment('pay-1', 'client-1')]);

      await useCase.execute('client-1', 'Admin');

      expect(mockPdfService.generateAccountStatement).toHaveBeenCalledWith(
        expect.objectContaining({
          payments: expect.arrayContaining([
            expect.objectContaining({ id: 'pay-1', amount: 50 }),
          ]),
        }),
      );
    });

    it('retorna el Buffer producido por pdfService', async () => {
      mockClientRepo.findById.mockResolvedValue(makeClient());
      mockSaleRepo.findByClientId.mockResolvedValue([]);
      mockPaymentRepo.findByClientId.mockResolvedValue([]);
      const customBuffer = Buffer.from('real-pdf-bytes');
      mockPdfService.generateAccountStatement.mockResolvedValue(customBuffer);

      const result = await useCase.execute('client-1', 'Admin');

      expect(result).toBe(customBuffer);
    });
  });
});
