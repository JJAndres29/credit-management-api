/**
 * Tests — QuickCreateWithVariantsUseCase + QuickCreateWithVariantsDto
 *
 * Pure domain-level tests — no infrastructure, no DB, no HTTP.
 */

import { QuickCreateWithVariantsUseCase } from './quick-create-with-variants.use-case';
import { QuickCreateWithVariantsDto } from '../../dtos/products/quick-create-with-variants.dto';
import { ProductRepository } from '../../repositories';
import { ProductEntity } from '../../entities/product.entity';
import { ProductVariantEntity } from '../../entities/product-variant.entity';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeProduct(): ProductEntity {
  return new ProductEntity(
    'prod-1',
    'Edredón Tipo Conejo',
    'Edredón suave de microfibra disponible en varios colores',
    25,
    100_000,
    50_000,
    null,
    [],
    'cat-1',
    'Edredones',
    [{ attribute: 'Material', value: 'Microfibra' }],
    true,
    new Date(),
    new Date(),
    'edredon-tipo-conejo-abc12345',
    null,
    null,
    null,
    null,
    [
      new ProductVariantEntity(
        'var-1', 'prod-1', 'EDREDON-ROJO-DOBLE', null, 'Rojo / Doble',
        10, 100_000, 50_000, 'COP', true, true,
        [
          { attributeId: 'a1', attributeName: 'Color', valueId: 'v1', value: 'Rojo' },
          { attributeId: 'a2', attributeName: 'Tamaño', valueId: 'v2', value: 'Doble' },
        ],
        new Date(), new Date(),
      ),
      new ProductVariantEntity(
        'var-2', 'prod-1', 'EDREDON-AZUL-DOBLE', null, 'Azul / Doble',
        15, 100_000, 50_000, 'COP', false, true,
        [
          { attributeId: 'a1', attributeName: 'Color', valueId: 'v3', value: 'Azul' },
          { attributeId: 'a2', attributeName: 'Tamaño', valueId: 'v2', value: 'Doble' },
        ],
        new Date(), new Date(),
      ),
    ],
  );
}

function validInput(): Record<string, unknown> {
  return {
    name: 'Edredón Tipo Conejo',
    description: 'Edredón suave de microfibra disponible en varios colores y tamaños',
    category: { name: 'Edredones' },
    attributes: [{ name: 'Material', value: 'Microfibra' }],
    variants: [
      {
        attributes: [
          { name: 'Color', value: 'Rojo' },
          { name: 'Tamaño', value: 'Doble' },
        ],
        stock: 10,
        retailPrice: 100_000,
        investmentCost: 50_000,
        sku: 'EDREDON-ROJO-DOBLE',
        label: 'Rojo / Doble',
      },
      {
        attributes: [
          { name: 'Color', value: 'Azul' },
          { name: 'Tamaño', value: 'Doble' },
        ],
        stock: 15,
        retailPrice: 100_000,
        investmentCost: 50_000,
        sku: 'EDREDON-AZUL-DOBLE',
      },
    ],
  };
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
  updateRetailPrice: jest.fn(),
  assignAttributes: jest.fn(),
  replaceAttributes: jest.fn(),
  removeAttribute: jest.fn(),
  quickCreate: jest.fn(),
  quickCreateWithVariants: jest.fn(),
  addAssets: jest.fn(),
  findAssetById: jest.fn(),
  removeAsset: jest.fn(),
  reuseGeneralAssetsForVariant: jest.fn(),
  countAssetsByCloudinaryPublicId: jest.fn(),
  bulkSetActive: jest.fn(),
} as jest.Mocked<ProductRepository>;

// ─── QuickCreateWithVariantsUseCase ──────────────────────────────────────────

describe('QuickCreateWithVariantsUseCase', () => {
  let useCase: QuickCreateWithVariantsUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new QuickCreateWithVariantsUseCase(mockProductRepo);
  });

  it('delega al repositorio con los datos del DTO', async () => {
    const product = makeProduct();
    mockProductRepo.quickCreateWithVariants.mockResolvedValue(product);

    const [, dto] = QuickCreateWithVariantsDto.create(validInput());
    const result = await useCase.execute(dto!);

    expect(mockProductRepo.quickCreateWithVariants).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Edredón Tipo Conejo',
        categoryName: 'Edredones',
        variants: expect.arrayContaining([
          expect.objectContaining({ sku: 'EDREDON-ROJO-DOBLE', stock: 10 }),
          expect.objectContaining({ sku: 'EDREDON-AZUL-DOBLE', stock: 15 }),
        ]),
      }),
    );
    expect(result).toBe(product);
  });

  it('pasa atributos del producto y de cada variante', async () => {
    mockProductRepo.quickCreateWithVariants.mockResolvedValue(makeProduct());

    const [, dto] = QuickCreateWithVariantsDto.create(validInput());
    await useCase.execute(dto!);

    const callData = mockProductRepo.quickCreateWithVariants.mock.calls[0][0];
    expect(callData.attributes).toEqual([{ name: 'Material', value: 'Microfibra' }]);
    expect(callData.variants[0].attributes).toEqual([
      { name: 'Color', value: 'Rojo' },
      { name: 'Tamaño', value: 'Doble' },
    ]);
  });

  it('pasa weightKg y brand cuando se proporcionan', async () => {
    mockProductRepo.quickCreateWithVariants.mockResolvedValue(makeProduct());

    const input = { ...validInput(), weightKg: 2.5, brand: 'Nyddo' };
    const [, dto] = QuickCreateWithVariantsDto.create(input);
    await useCase.execute(dto!);

    const callData = mockProductRepo.quickCreateWithVariants.mock.calls[0][0];
    expect(callData.weightKg).toBe(2.5);
    expect(callData.brand).toBe('Nyddo');
  });

  it('pasa null en weightKg y brand cuando no se proporcionan', async () => {
    mockProductRepo.quickCreateWithVariants.mockResolvedValue(makeProduct());

    const [, dto] = QuickCreateWithVariantsDto.create(validInput());
    await useCase.execute(dto!);

    const callData = mockProductRepo.quickCreateWithVariants.mock.calls[0][0];
    expect(callData.weightKg).toBeNull();
    expect(callData.brand).toBeNull();
  });
});

// ─── QuickCreateWithVariantsDto — validación del producto ────────────────────

describe('QuickCreateWithVariantsDto — producto', () => {
  it('rechaza name muy corto', () => {
    const [error] = QuickCreateWithVariantsDto.create({ ...validInput(), name: 'A' });
    expect(error).toContain('name');
  });

  it('rechaza name ausente', () => {
    const input = validInput();
    delete (input as Record<string, unknown>).name;
    const [error] = QuickCreateWithVariantsDto.create(input);
    expect(error).toContain('name');
  });

  it('rechaza description muy corta', () => {
    const [error] = QuickCreateWithVariantsDto.create({ ...validInput(), description: 'corta' });
    expect(error).toContain('description');
  });

  it('rechaza category ausente', () => {
    const input = validInput();
    delete (input as Record<string, unknown>).category;
    const [error] = QuickCreateWithVariantsDto.create(input);
    expect(error).toContain('category');
  });

  it('rechaza category.name muy corto', () => {
    const [error] = QuickCreateWithVariantsDto.create({ ...validInput(), category: { name: 'A' } });
    expect(error).toContain('category.name');
  });

  it('rechaza attributes no array', () => {
    const [error] = QuickCreateWithVariantsDto.create({ ...validInput(), attributes: 'no' });
    expect(error).toContain('attributes');
  });

  it('acepta attributes vacío (producto sin atributos de nivel producto)', () => {
    const [error, dto] = QuickCreateWithVariantsDto.create({ ...validInput(), attributes: [] });
    expect(error).toBeUndefined();
    expect(dto!.attributes).toEqual([]);
  });

  it('rechaza attribute.name vacío', () => {
    const [error] = QuickCreateWithVariantsDto.create({
      ...validInput(),
      attributes: [{ name: '', value: 'Microfibra' }],
    });
    expect(error).toContain('attribute.name');
  });

  it('rechaza attribute.value vacío', () => {
    const [error] = QuickCreateWithVariantsDto.create({
      ...validInput(),
      attributes: [{ name: 'Material', value: '' }],
    });
    expect(error).toContain('attribute.value');
  });
});

// ─── QuickCreateWithVariantsDto — validación de variantes ────────────────────

describe('QuickCreateWithVariantsDto — variantes', () => {
  it('rechaza variants vacío', () => {
    const [error] = QuickCreateWithVariantsDto.create({ ...validInput(), variants: [] });
    expect(error).toContain('al menos una variante');
  });

  it('rechaza variants no array', () => {
    const [error] = QuickCreateWithVariantsDto.create({ ...validInput(), variants: 'no' });
    expect(error).toContain('variants');
  });

  it('rechaza variante sin attributes', () => {
    const input = validInput();
    (input.variants as Record<string, unknown>[])[0].attributes = [];
    const [error] = QuickCreateWithVariantsDto.create(input);
    expect(error).toContain('attributes');
    expect(error).toContain('variants[0]');
  });

  it('rechaza variante con stock negativo', () => {
    const input = validInput();
    (input.variants as Record<string, unknown>[])[0].stock = -1;
    const [error] = QuickCreateWithVariantsDto.create(input);
    expect(error).toContain('stock');
  });

  it('rechaza variante con stock no entero', () => {
    const input = validInput();
    (input.variants as Record<string, unknown>[])[0].stock = 1.5;
    const [error] = QuickCreateWithVariantsDto.create(input);
    expect(error).toContain('stock');
  });

  it('rechaza variante sin retailPrice', () => {
    const input = validInput();
    delete (input.variants as Record<string, unknown>[])[0].retailPrice;
    const [error] = QuickCreateWithVariantsDto.create(input);
    expect(error).toContain('retailPrice');
  });

  it('rechaza variante con retailPrice <= 0', () => {
    const input = validInput();
    (input.variants as Record<string, unknown>[])[0].retailPrice = 0;
    const [error] = QuickCreateWithVariantsDto.create(input);
    expect(error).toContain('retailPrice');
  });

  it('rechaza variante sin investmentCost', () => {
    const input = validInput();
    delete (input.variants as Record<string, unknown>[])[0].investmentCost;
    const [error] = QuickCreateWithVariantsDto.create(input);
    expect(error).toContain('investmentCost');
  });

  it('rechaza variante con investmentCost negativo', () => {
    const input = validInput();
    (input.variants as Record<string, unknown>[])[0].investmentCost = -100;
    const [error] = QuickCreateWithVariantsDto.create(input);
    expect(error).toContain('investmentCost');
  });

  it('rechaza combinación de atributos duplicada entre variantes', () => {
    const input = validInput();
    const variants = input.variants as Record<string, unknown>[];
    variants[1] = {
      ...variants[0],
      sku: 'DUPLICATE',
    };
    const [error] = QuickCreateWithVariantsDto.create(input);
    expect(error).toContain('duplicada');
  });

  it('rechaza atributo duplicado dentro de una misma variante', () => {
    const input = validInput();
    const variants = input.variants as Record<string, unknown>[];
    variants[0] = {
      ...variants[0],
      attributes: [
        { name: 'Color', value: 'Rojo' },
        { name: 'Color', value: 'Azul' },
      ],
    };
    const [error] = QuickCreateWithVariantsDto.create(input);
    expect(error).toContain('duplicado');
  });

  it('rechaza si una variante no define todos los atributos que las demás sí definen', () => {
    const input = validInput();
    const variants = input.variants as Record<string, unknown>[];
    variants[1] = {
      attributes: [{ name: 'Color', value: 'Azul' }],
      stock: 15,
      retailPrice: 100_000,
      investmentCost: 50_000,
    };
    const [error] = QuickCreateWithVariantsDto.create(input);
    expect(error).toContain('mismos atributos');
  });

  it('limpia espacios en sku y label', () => {
    const input = validInput();
    const variants = input.variants as Record<string, unknown>[];
    variants[0].sku = '  SKU-CLEAN  ';
    variants[0].label = '  Rojo / Doble  ';
    const [, dto] = QuickCreateWithVariantsDto.create(input);
    expect(dto!.variants[0].sku).toBe('SKU-CLEAN');
    expect(dto!.variants[0].label).toBe('Rojo / Doble');
  });

  it('convierte sku y label vacíos a null', () => {
    const input = validInput();
    const variants = input.variants as Record<string, unknown>[];
    variants[0].sku = '   ';
    variants[0].label = '   ';
    const [, dto] = QuickCreateWithVariantsDto.create(input);
    expect(dto!.variants[0].sku).toBeNull();
    expect(dto!.variants[0].label).toBeNull();
  });

  it('acepta variante sin sku ni label (opcionales)', () => {
    const input = validInput();
    const variants = input.variants as Record<string, unknown>[];
    delete variants[0].sku;
    delete variants[0].label;
    const [error, dto] = QuickCreateWithVariantsDto.create(input);
    expect(error).toBeUndefined();
    expect(dto!.variants[0].sku).toBeNull();
    expect(dto!.variants[0].label).toBeNull();
  });
});

// ─── QuickCreateWithVariantsDto — campos opcionales de producto ──────────────

describe('QuickCreateWithVariantsDto — campos opcionales', () => {
  it('rechaza weightKg fuera de rango', () => {
    const [error] = QuickCreateWithVariantsDto.create({ ...validInput(), weightKg: 600 });
    expect(error).toContain('weightKg');
  });

  it('rechaza weightKg negativo', () => {
    const [error] = QuickCreateWithVariantsDto.create({ ...validInput(), weightKg: -1 });
    expect(error).toContain('weightKg');
  });

  it('acepta weightKg válido', () => {
    const [error, dto] = QuickCreateWithVariantsDto.create({ ...validInput(), weightKg: 2.5 });
    expect(error).toBeUndefined();
    expect(dto!.weightKg).toBe(2.5);
  });

  it('acepta brand válido', () => {
    const [error, dto] = QuickCreateWithVariantsDto.create({ ...validInput(), brand: 'Nyddo' });
    expect(error).toBeUndefined();
    expect(dto!.brand).toBe('Nyddo');
  });

  it('convierte brand vacío a null', () => {
    const [error, dto] = QuickCreateWithVariantsDto.create({ ...validInput(), brand: '  ' });
    expect(error).toBeUndefined();
    expect(dto!.brand).toBeNull();
  });
});

// ─── QuickCreateWithVariantsDto — DTO válido completo ────────────────────────

describe('QuickCreateWithVariantsDto — DTO válido', () => {
  it('parsea correctamente todos los campos', () => {
    const [error, dto] = QuickCreateWithVariantsDto.create(validInput());
    expect(error).toBeUndefined();
    expect(dto).toBeDefined();
    expect(dto!.name).toBe('Edredón Tipo Conejo');
    expect(dto!.categoryName).toBe('Edredones');
    expect(dto!.attributes).toHaveLength(1);
    expect(dto!.variants).toHaveLength(2);
    expect(dto!.variants[0].retailPrice).toBe(100_000);
    expect(dto!.variants[0].investmentCost).toBe(50_000);
    expect(dto!.variants[1].sku).toBe('EDREDON-AZUL-DOBLE');
    expect(dto!.variants[1].label).toBeNull();
  });

  it('limpia espacios del nombre y descripción', () => {
    const input = {
      ...validInput(),
      name: '  Edredón con espacios  ',
      description: '  Descripción con espacios que tiene más de treinta caracteres mínimos  ',
    };
    const [, dto] = QuickCreateWithVariantsDto.create(input);
    expect(dto!.name).toBe('Edredón con espacios');
    expect(dto!.description).toBe('Descripción con espacios que tiene más de treinta caracteres mínimos');
  });

  it('acepta una sola variante (el mínimo)', () => {
    const input = {
      ...validInput(),
      variants: [
        {
          attributes: [{ name: 'Color', value: 'Rojo' }],
          stock: 10,
          retailPrice: 100_000,
          investmentCost: 50_000,
        },
      ],
    };
    const [error, dto] = QuickCreateWithVariantsDto.create(input);
    expect(error).toBeUndefined();
    expect(dto!.variants).toHaveLength(1);
  });

  it('detecta combinaciones duplicadas ignorando orden de atributos', () => {
    const input = {
      ...validInput(),
      variants: [
        {
          attributes: [
            { name: 'Color', value: 'Rojo' },
            { name: 'Tamaño', value: 'Doble' },
          ],
          stock: 10, retailPrice: 100_000, investmentCost: 50_000,
        },
        {
          attributes: [
            { name: 'Tamaño', value: 'Doble' },
            { name: 'Color', value: 'Rojo' },
          ],
          stock: 15, retailPrice: 100_000, investmentCost: 50_000,
        },
      ],
    };
    const [error] = QuickCreateWithVariantsDto.create(input);
    expect(error).toContain('duplicada');
  });
});
