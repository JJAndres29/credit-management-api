import { CreateCategoryDto } from '../../dtos/categories';
import {
  CreateAttributeValueUseCase,
  CreateCategoryAttributeUseCase,
  CreateCategoryUseCase,
} from './index';
import { CategoryRepository } from '../../repositories';

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

describe('Category management use cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('crea categoría, atributo y valor dinámico', async () => {
    mockCategoryRepo.create.mockResolvedValue({ id: 'cat-1', name: 'Sabanas' } as never);
    mockCategoryRepo.findById.mockResolvedValue({ id: 'cat-1', name: 'Sabanas' } as never);
    mockCategoryRepo.createAttribute.mockResolvedValue({ id: 'attr-1', categoryId: 'cat-1', name: 'Color' } as never);
    mockCategoryRepo.createValue.mockResolvedValue({ id: 'val-1', attributeId: 'attr-1', value: 'Rojo' } as never);

    const createCategory = new CreateCategoryUseCase(mockCategoryRepo);
    const createAttribute = new CreateCategoryAttributeUseCase(mockCategoryRepo);
    const createValue = new CreateAttributeValueUseCase(mockCategoryRepo);

    const [, catDto] = CreateCategoryDto.create({ name: 'Sabanas' });
    const category = await createCategory.execute(catDto!);
    const attribute = await createAttribute.execute('cat-1', 'Color');
    const value = await createValue.execute('attr-1', 'Rojo');

    expect(category.id).toBe('cat-1');
    expect(attribute.name).toBe('Color');
    expect(value.value).toBe('Rojo');
  });
});
