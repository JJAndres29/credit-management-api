import { ReplaceProductAttributesUseCase } from './replace-product-attributes.use-case';
import { CategoryRepository, ProductRepository } from '../../repositories';
import { ProductEntity } from '../../entities';

const makeProduct = (): ProductEntity =>
  ProductEntity.fromObject({
    id: 'prod-1',
    name: 'Toalla',
    stock: 10,
    images: [],
    categoryId: 'cat-1',
    category: { id: 'cat-1', name: 'Toallas' },
    attributes: [],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

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
  quickCreate: jest.fn(),
  quickCreateWithVariants: jest.fn(),
  addAssets: jest.fn(),
  findAssetById: jest.fn(),
  removeAsset: jest.fn(),
  reuseGeneralAssetsForVariant: jest.fn(),
  countAssetsByCloudinaryPublicId: jest.fn(),
  bulkSetActive: jest.fn(),
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

describe('ReplaceProductAttributesUseCase', () => {
  it('reemplaza completamente los atributos del producto', async () => {
    const useCase = new ReplaceProductAttributesUseCase(mockProductRepo, mockCategoryRepo);
    mockProductRepo.findById.mockResolvedValue(makeProduct());
    mockCategoryRepo.areValuesFromCategory.mockResolvedValue(true);
    mockProductRepo.replaceAttributes.mockResolvedValue(makeProduct());

    await useCase.execute('prod-1', ['value-1']);

    expect(mockProductRepo.replaceAttributes).toHaveBeenCalledWith('prod-1', ['value-1']);
  });
});
