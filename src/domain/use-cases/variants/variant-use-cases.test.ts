/**
 * Tests — Variant Use Cases + DTOs
 *
 * Covers GetVariantsUseCase, CreateVariantUseCase, UpdateVariantUseCase,
 * DeleteVariantUseCase and their respective DTOs.
 * Pure domain-level tests — no infrastructure, no DB, no HTTP.
 */

import { GetVariantsUseCase } from './get-variants.use-case';
import { CreateVariantUseCase } from './create-variant.use-case';
import { UpdateVariantUseCase } from './update-variant.use-case';
import { DeleteVariantUseCase } from './delete-variant.use-case';
import { CreateVariantDto, UpdateVariantDto } from '../../dtos/variants';
import { ProductRepository } from '../../repositories';
import { VariantRepository } from '../../repositories/variant.repository';
import { ProductEntity } from '../../entities/product.entity';
import { ProductVariantEntity } from '../../entities/product-variant.entity';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeProduct(overrides: Partial<{
  id: string;
  isActive: boolean;
  categoryId: string | null;
}> = {}): ProductEntity {
  const catId = 'categoryId' in overrides ? overrides.categoryId! : 'cat-1';
  return new ProductEntity(
    overrides.id ?? 'prod-1',
    'Edredón Tipo Conejo',
    'Edredón suave',
    50,
    100_000,
    50_000,
    null,
    [],
    catId,
    catId ? 'Edredones' : null,
    [],
    overrides.isActive ?? true,
    new Date(),
    new Date(),
  );
}

function makeVariant(overrides: Partial<{
  id: string;
  productId: string;
  isDefault: boolean;
  label: string;
  stock: number;
  isActive: boolean;
}> = {}): ProductVariantEntity {
  return new ProductVariantEntity(
    overrides.id ?? 'var-1',
    overrides.productId ?? 'prod-1',
    null,
    null,
    overrides.label ?? 'Rojo / Doble',
    overrides.stock ?? 10,
    100_000,
    50_000,
    'COP',
    overrides.isDefault ?? false,
    overrides.isActive ?? true,
    [
      { attributeId: 'attr-color', attributeName: 'Color', valueId: 'val-rojo', value: 'Rojo' },
      { attributeId: 'attr-size', attributeName: 'Tamaño', valueId: 'val-doble', value: 'Doble' },
    ],
    new Date(),
    new Date(),
  );
}

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockProductRepo = {
  findById: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  adjustStock: jest.fn(),
  delete: jest.fn(),
  addImages: jest.fn(),
  removeImage: jest.fn(),
  assignAttributes: jest.fn(),
  replaceAttributes: jest.fn(),
  removeAttribute: jest.fn(),
  updateRetailPrice: jest.fn(),
  quickCreate: jest.fn(),
  bulkSetActive: jest.fn(),
} as jest.Mocked<ProductRepository>;

const mockVariantRepo = {
  findByProductId: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
} as jest.Mocked<VariantRepository>;

// ─── GetVariantsUseCase ───────────────────────────────────────────────────────

describe('GetVariantsUseCase', () => {
  let useCase: GetVariantsUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new GetVariantsUseCase(mockProductRepo, mockVariantRepo);
  });

  it('lanza 404 si el producto no existe', async () => {
    mockProductRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('prod-missing')).rejects.toMatchObject({
      statusCode: 404,
      message: expect.stringContaining('prod-missing'),
    });
    expect(mockVariantRepo.findByProductId).not.toHaveBeenCalled();
  });

  it('retorna las variantes del producto', async () => {
    mockProductRepo.findById.mockResolvedValue(makeProduct());
    const variants = [makeVariant({ id: 'v1' }), makeVariant({ id: 'v2', label: 'Azul / Sencillo' })];
    mockVariantRepo.findByProductId.mockResolvedValue(variants);

    const result = await useCase.execute('prod-1');

    expect(mockVariantRepo.findByProductId).toHaveBeenCalledWith('prod-1');
    expect(result).toHaveLength(2);
  });

  it('retorna arreglo vacío si el producto no tiene variantes', async () => {
    mockProductRepo.findById.mockResolvedValue(makeProduct());
    mockVariantRepo.findByProductId.mockResolvedValue([]);

    const result = await useCase.execute('prod-1');
    expect(result).toEqual([]);
  });
});

// ─── CreateVariantUseCase ─────────────────────────────────────────────────────

describe('CreateVariantUseCase', () => {
  let useCase: CreateVariantUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new CreateVariantUseCase(mockProductRepo, mockVariantRepo);
  });

  describe('validación del producto', () => {
    it('lanza 404 si el producto no existe', async () => {
      mockProductRepo.findById.mockResolvedValue(null);

      const [, dto] = CreateVariantDto.create({
        productId: 'prod-missing',
        attributeValueIds: ['val-1'],
        stock: 10,
      });

      await expect(useCase.execute(dto!)).rejects.toMatchObject({
        statusCode: 404,
        message: expect.stringContaining('prod-missing'),
      });
    });

    it('lanza 400 si el producto está inactivo', async () => {
      mockProductRepo.findById.mockResolvedValue(makeProduct({ isActive: false }));

      const [, dto] = CreateVariantDto.create({
        productId: 'prod-1',
        attributeValueIds: ['val-1'],
        stock: 10,
      });

      await expect(useCase.execute(dto!)).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('inactivo'),
      });
    });

    it('lanza 400 si el producto no tiene categoría', async () => {
      mockProductRepo.findById.mockResolvedValue(makeProduct({ categoryId: null }));

      const [, dto] = CreateVariantDto.create({
        productId: 'prod-1',
        attributeValueIds: ['val-1'],
        stock: 10,
      });

      await expect(useCase.execute(dto!)).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('categoría'),
      });
    });
  });

  describe('creación exitosa', () => {
    it('delega al repositorio con datos correctos', async () => {
      mockProductRepo.findById.mockResolvedValue(makeProduct());
      mockVariantRepo.create.mockResolvedValue(makeVariant());

      const [, dto] = CreateVariantDto.create({
        productId: 'prod-1',
        attributeValueIds: ['val-rojo', 'val-doble'],
        stock: 10,
        sku: 'EDREDON-ROJO-DOBLE',
        label: 'Rojo / Doble',
        retailPrice: 100_000,
        investmentCost: 50_000,
      });

      const result = await useCase.execute(dto!);

      expect(mockVariantRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 'prod-1',
          attributeValueIds: ['val-rojo', 'val-doble'],
          stock: 10,
          sku: 'EDREDON-ROJO-DOBLE',
          label: 'Rojo / Doble',
        }),
      );

      expect(result).toBeDefined();
      expect(result.isDefault).toBe(false);
      expect(result.attributeValues).toHaveLength(2);
    });

    it('crea variante sin sku ni label (opcionales)', async () => {
      mockProductRepo.findById.mockResolvedValue(makeProduct());
      mockVariantRepo.create.mockResolvedValue(makeVariant());

      const [, dto] = CreateVariantDto.create({
        productId: 'prod-1',
        attributeValueIds: ['val-rojo'],
        stock: 5,
      });

      await useCase.execute(dto!);

      expect(mockVariantRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sku: null,
          label: null,
        }),
      );
    });
  });
});

// ─── UpdateVariantUseCase ─────────────────────────────────────────────────────

describe('UpdateVariantUseCase', () => {
  let useCase: UpdateVariantUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new UpdateVariantUseCase(mockVariantRepo);
  });

  it('lanza 404 si la variante no existe', async () => {
    mockVariantRepo.findById.mockResolvedValue(null);

    const [, dto] = UpdateVariantDto.create({ stock: 20 });

    await expect(useCase.execute('var-missing', dto!)).rejects.toMatchObject({
      statusCode: 404,
      message: expect.stringContaining('var-missing'),
    });
    expect(mockVariantRepo.update).not.toHaveBeenCalled();
  });

  it('actualiza la variante y retorna la entidad actualizada', async () => {
    const existing = makeVariant({ stock: 10 });
    const updated = makeVariant({ stock: 20 });
    mockVariantRepo.findById.mockResolvedValue(existing);
    mockVariantRepo.update.mockResolvedValue(updated);

    const [, dto] = UpdateVariantDto.create({ stock: 20 });
    const result = await useCase.execute('var-1', dto!);

    expect(mockVariantRepo.update).toHaveBeenCalledWith(
      'var-1',
      expect.objectContaining({ stock: 20 }),
    );
    expect(result.stock).toBe(20);
  });

  it('actualiza solo los campos proporcionados', async () => {
    mockVariantRepo.findById.mockResolvedValue(makeVariant());
    mockVariantRepo.update.mockResolvedValue(makeVariant());

    const [, dto] = UpdateVariantDto.create({ label: 'Azul / Sencillo' });
    await useCase.execute('var-1', dto!);

    expect(mockVariantRepo.update).toHaveBeenCalledWith(
      'var-1',
      expect.objectContaining({ label: 'Azul / Sencillo' }),
    );
  });

  it('pasa isActive al repositorio', async () => {
    mockVariantRepo.findById.mockResolvedValue(makeVariant());
    mockVariantRepo.update.mockResolvedValue(makeVariant({ isActive: false }));

    const [, dto] = UpdateVariantDto.create({ isActive: false });
    await useCase.execute('var-1', dto!);

    expect(mockVariantRepo.update).toHaveBeenCalledWith(
      'var-1',
      expect.objectContaining({ isActive: false }),
    );
  });
});

// ─── DeleteVariantUseCase ─────────────────────────────────────────────────────

describe('DeleteVariantUseCase', () => {
  let useCase: DeleteVariantUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new DeleteVariantUseCase(mockVariantRepo);
  });

  it('lanza 404 si la variante no existe', async () => {
    mockVariantRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('var-missing')).rejects.toMatchObject({
      statusCode: 404,
      message: expect.stringContaining('var-missing'),
    });
    expect(mockVariantRepo.delete).not.toHaveBeenCalled();
  });

  it('elimina la variante y retorna la entidad eliminada', async () => {
    const variant = makeVariant();
    mockVariantRepo.findById.mockResolvedValue(variant);
    mockVariantRepo.delete.mockResolvedValue(variant);

    const result = await useCase.execute('var-1');

    expect(mockVariantRepo.delete).toHaveBeenCalledWith('var-1');
    expect(result.id).toBe('var-1');
  });
});

// ─── CreateVariantDto ─────────────────────────────────────────────────────────

describe('CreateVariantDto', () => {
  it('rechaza si falta productId', () => {
    const [error] = CreateVariantDto.create({
      attributeValueIds: ['val-1'],
      stock: 10,
    });
    expect(error).toContain('productId');
  });

  it('rechaza si attributeValueIds está vacío', () => {
    const [error] = CreateVariantDto.create({
      productId: 'prod-1',
      attributeValueIds: [],
      stock: 10,
    });
    expect(error).toContain('al menos un ID');
  });

  it('rechaza si hay IDs duplicados', () => {
    const [error] = CreateVariantDto.create({
      productId: 'prod-1',
      attributeValueIds: ['val-1', 'val-1'],
      stock: 10,
    });
    expect(error).toContain('duplicados');
  });

  it('rechaza attributeValueId no string', () => {
    const [error] = CreateVariantDto.create({
      productId: 'prod-1',
      attributeValueIds: [123],
      stock: 10,
    });
    expect(error).toContain('string no vacío');
  });

  it('rechaza stock negativo', () => {
    const [error] = CreateVariantDto.create({
      productId: 'prod-1',
      attributeValueIds: ['val-1'],
      stock: -1,
    });
    expect(error).toContain('stock');
  });

  it('rechaza stock no entero', () => {
    const [error] = CreateVariantDto.create({
      productId: 'prod-1',
      attributeValueIds: ['val-1'],
      stock: 1.5,
    });
    expect(error).toContain('stock');
  });

  it('rechaza retailPrice negativo', () => {
    const [error] = CreateVariantDto.create({
      productId: 'prod-1',
      attributeValueIds: ['val-1'],
      stock: 10,
      retailPrice: -100,
    });
    expect(error).toContain('retailPrice');
  });

  it('rechaza investmentCost negativo', () => {
    const [error] = CreateVariantDto.create({
      productId: 'prod-1',
      attributeValueIds: ['val-1'],
      stock: 10,
      investmentCost: -50,
    });
    expect(error).toContain('investmentCost');
  });

  it('acepta DTO válido con todos los campos', () => {
    const [error, dto] = CreateVariantDto.create({
      productId: 'prod-1',
      attributeValueIds: ['val-1', 'val-2'],
      stock: 10,
      sku: 'SKU-001',
      label: 'Rojo / Doble',
      retailPrice: 100_000,
      investmentCost: 50_000,
    });
    expect(error).toBeUndefined();
    expect(dto).toBeDefined();
    expect(dto!.attributeValueIds).toEqual(['val-1', 'val-2']);
    expect(dto!.sku).toBe('SKU-001');
  });

  it('acepta DTO mínimo sin campos opcionales', () => {
    const [error, dto] = CreateVariantDto.create({
      productId: 'prod-1',
      attributeValueIds: ['val-1'],
      stock: 0,
    });
    expect(error).toBeUndefined();
    expect(dto!.sku).toBeNull();
    expect(dto!.label).toBeNull();
    expect(dto!.retailPrice).toBeNull();
    expect(dto!.investmentCost).toBeNull();
  });

  it('limpia espacios en sku y label', () => {
    const [, dto] = CreateVariantDto.create({
      productId: 'prod-1',
      attributeValueIds: ['val-1'],
      stock: 5,
      sku: '  SKU-CLEAN  ',
      label: '  Rojo  ',
    });
    expect(dto!.sku).toBe('SKU-CLEAN');
    expect(dto!.label).toBe('Rojo');
  });

  it('convierte sku vacío a null', () => {
    const [, dto] = CreateVariantDto.create({
      productId: 'prod-1',
      attributeValueIds: ['val-1'],
      stock: 5,
      sku: '   ',
    });
    expect(dto!.sku).toBeNull();
  });
});

// ─── UpdateVariantDto ─────────────────────────────────────────────────────────

describe('UpdateVariantDto', () => {
  it('rechaza si no se proporciona ningún campo', () => {
    const [error] = UpdateVariantDto.create({});
    expect(error).toContain('al menos un campo');
  });

  it('rechaza stock negativo', () => {
    const [error] = UpdateVariantDto.create({ stock: -5 });
    expect(error).toContain('stock');
  });

  it('rechaza stock no entero', () => {
    const [error] = UpdateVariantDto.create({ stock: 2.7 });
    expect(error).toContain('stock');
  });

  it('rechaza retailPrice negativo', () => {
    const [error] = UpdateVariantDto.create({ retailPrice: -1 });
    expect(error).toContain('retailPrice');
  });

  it('rechaza investmentCost negativo', () => {
    const [error] = UpdateVariantDto.create({ investmentCost: -1 });
    expect(error).toContain('investmentCost');
  });

  it('rechaza isActive no booleano', () => {
    const [error] = UpdateVariantDto.create({ isActive: 'true' });
    expect(error).toContain('isActive');
  });

  it('rechaza sku no string', () => {
    const [error] = UpdateVariantDto.create({ sku: 123 });
    expect(error).toContain('sku');
  });

  it('acepta actualización solo de stock', () => {
    const [error, dto] = UpdateVariantDto.create({ stock: 50 });
    expect(error).toBeUndefined();
    expect(dto!.stock).toBe(50);
  });

  it('acepta actualización solo de label', () => {
    const [error, dto] = UpdateVariantDto.create({ label: 'Nuevo Label' });
    expect(error).toBeUndefined();
    expect(dto!.label).toBe('Nuevo Label');
  });

  it('acepta null para campos anulables', () => {
    const [error, dto] = UpdateVariantDto.create({ sku: null, retailPrice: null });
    expect(error).toBeUndefined();
    expect(dto!.sku).toBeNull();
    expect(dto!.retailPrice).toBeNull();
  });

  it('acepta todos los campos simultáneamente', () => {
    const [error, dto] = UpdateVariantDto.create({
      sku: 'NEW-SKU',
      label: 'Azul / Sencillo',
      stock: 30,
      retailPrice: 80_000,
      investmentCost: 40_000,
      isActive: false,
    });
    expect(error).toBeUndefined();
    expect(dto!.sku).toBe('NEW-SKU');
    expect(dto!.stock).toBe(30);
    expect(dto!.isActive).toBe(false);
  });

  it('limpia espacios en label', () => {
    const [, dto] = UpdateVariantDto.create({ label: '  Rojo Vivo  ' });
    expect(dto!.label).toBe('Rojo Vivo');
  });

  it('convierte label vacío a null', () => {
    const [, dto] = UpdateVariantDto.create({ label: '   ' });
    expect(dto!.label).toBeNull();
  });
});
