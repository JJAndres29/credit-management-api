import { AssignProductAttributesUseCase } from './assign-product-attributes.use-case';
import { CategoryRepository, ProductRepository } from '../../repositories';
import { ProductEntity } from '../../entities';

const makeProduct = (overrides: Record<string, unknown> = {}): ProductEntity =>
  ProductEntity.fromObject({
    id: 'prod-1',
    name: 'Sabana Queen',
    stock: 10,
    images: [],
    categoryId: 'cat-1',
    category: { id: 'cat-1', name: 'Sabanas' },
    attributes: [],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as Record<string, unknown>);

const mockProductRepo = {
  findAll: jest.fn(),
  findById: jest.fn(),
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
} as jest.Mocked<ProductRepository>;

const mockCategoryRepo = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  createAttribute: jest.fn(),
  findAttributeById: jest.fn(),
  updateAttribute: jest.fn(),
  findAttributesByCategory: jest.fn(),
  deleteAttribute: jest.fn(),
  createValue: jest.fn(),
  findValueById: jest.fn(),
  updateValue: jest.fn(),
  findValuesByAttribute: jest.fn(),
  deleteValue: jest.fn(),
  areValuesFromCategory: jest.fn(),
} as jest.Mocked<CategoryRepository>;

describe('AssignProductAttributesUseCase', () => {
  let useCase: AssignProductAttributesUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new AssignProductAttributesUseCase(mockProductRepo, mockCategoryRepo);
  });

  it('asigna atributos cuando todos los valores son de la categoría del producto', async () => {
    mockProductRepo.findById.mockResolvedValue(makeProduct());
    mockCategoryRepo.areValuesFromCategory.mockResolvedValue(true);
    mockProductRepo.assignAttributes.mockResolvedValue(makeProduct({
      attributes: [
        { value: { value: 'Rojo', attribute: { name: 'Color' } } },
        { value: { value: 'Algodon', attribute: { name: 'Material' } } },
      ],
    }));

    const result = await useCase.execute('prod-1', ['value-color-red', 'value-material-cotton']);

    expect(mockCategoryRepo.areValuesFromCategory).toHaveBeenCalledWith('cat-1', [
      'value-color-red',
      'value-material-cotton',
    ]);
    expect(result.attributes).toHaveLength(2);
  });

  it('rechaza valores de otra categoría', async () => {
    mockProductRepo.findById.mockResolvedValue(makeProduct());
    mockCategoryRepo.areValuesFromCategory.mockResolvedValue(false);

    await expect(useCase.execute('prod-1', ['value-from-other-category'])).rejects.toMatchObject({
      statusCode: 400,
    });

    expect(mockProductRepo.assignAttributes).not.toHaveBeenCalled();
  });

  it('permite atributos dinámicos sin tocar Product (ej: "Material")', async () => {
    mockProductRepo.findById.mockResolvedValue(makeProduct());
    mockCategoryRepo.areValuesFromCategory.mockResolvedValue(true);
    mockProductRepo.assignAttributes.mockResolvedValue(makeProduct({
      attributes: [{ value: { value: 'Lino', attribute: { name: 'Material' } } }],
    }));

    const result = await useCase.execute('prod-1', ['value-material-lino']);
    expect(result.attributes).toEqual([{ attribute: 'Material', value: 'Lino' }]);
  });
});
