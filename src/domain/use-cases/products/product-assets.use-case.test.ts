/**
 * Tests — UploadProductAssetsUseCase + DeleteProductAssetUseCase
 *
 * Pure domain-level tests — no infrastructure, no DB, no HTTP.
 */

import { UploadProductAssetsUseCase } from './upload-product-assets.use-case';
import { DeleteProductAssetUseCase } from './delete-product-asset.use-case';
import { ReuseProductAssetsForVariantUseCase } from './reuse-product-assets-for-variant.use-case';
import { ReuseProductAssetsDto } from '../../dtos/products/reuse-product-assets.dto';
import { ProductRepository } from '../../repositories';
import type { VariantRepository } from '../../repositories/variant.repository';
import { FileStorageService } from '../../services/file-storage.service';
import { ProductEntity } from '../../entities/product.entity';
import { ProductAssetEntity } from '../../entities/product-asset.entity';
import { ProductVariantEntity } from '../../entities/product-variant.entity';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeProduct(overrides?: Partial<Record<string, unknown>>): ProductEntity {
  return new ProductEntity(
    overrides?.id as string ?? 'prod-1',
    'Edredón Tipo Conejo',
    null,
    25,
    100_000,
    50_000,
    null,
    [],
    'cat-1',
    'Edredones',
    [],
    true,
    new Date(),
    new Date(),
    null,
    null,
    null,
    null,
    null,
    [],
    [],
  );
}

function makeVariant(overrides?: Partial<{ id: string; productId: string }>): ProductVariantEntity {
  return new ProductVariantEntity(
    overrides?.id ?? 'var-1',
    overrides?.productId ?? 'prod-1',
    'EDREDON-ROJO',
    null,
    'Rojo',
    10,
    100_000,
    50_000,
    'COP',
    true,
    true,
    [],
    new Date(),
    new Date(),
  );
}

function makeAsset(overrides?: Partial<{ id: string; productId: string }>): ProductAssetEntity {
  return new ProductAssetEntity(
    overrides?.id ?? 'asset-1',
    overrides?.productId ?? 'prod-1',
    null,
    'IMAGE',
    0,
    null,
    'https://res.cloudinary.com/demo/image/upload/v1/products/test.jpg',
    'products/test',
    new Date(),
  );
}

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

const mockVariantRepo = {
  findByProductId: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  computeAttributeHash: jest.fn(),
} as jest.Mocked<VariantRepository>;

const mockFileStorage = {
  uploadBuffer: jest.fn(),
  deleteFile: jest.fn(),
} as jest.Mocked<FileStorageService>;

// ─── UploadProductAssetsUseCase ──────────────────────────────────────────────

describe('UploadProductAssetsUseCase', () => {
  let useCase: UploadProductAssetsUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new UploadProductAssetsUseCase(
      mockProductRepo,
      mockVariantRepo,
      mockFileStorage,
    );
  });

  it('sube assets a nivel de producto (sin variantId)', async () => {
    const product = makeProduct();
    mockProductRepo.findById.mockResolvedValue(product);
    mockFileStorage.uploadBuffer.mockResolvedValue({
      url: 'https://cloudinary.com/img1.jpg',
      publicId: 'products/img1',
    });
    mockProductRepo.addAssets.mockResolvedValue(product);

    const files = [{ buffer: Buffer.from('img'), mimetype: 'image/jpeg' }];
    const result = await useCase.execute('prod-1', files);

    expect(mockProductRepo.addAssets).toHaveBeenCalledWith({
      productId: 'prod-1',
      variantId: null,
      uploads: [{ url: 'https://cloudinary.com/img1.jpg', publicId: 'products/img1' }],
    });
    expect(result).toBe(product);
    expect(mockVariantRepo.findById).not.toHaveBeenCalled();
  });

  it('sube assets a una variante específica', async () => {
    const product = makeProduct();
    const variant = makeVariant({ id: 'var-1', productId: 'prod-1' });
    mockProductRepo.findById.mockResolvedValue(product);
    mockVariantRepo.findById.mockResolvedValue(variant);
    mockFileStorage.uploadBuffer.mockResolvedValue({
      url: 'https://cloudinary.com/img2.jpg',
      publicId: 'products/img2',
    });
    mockProductRepo.addAssets.mockResolvedValue(product);

    const files = [{ buffer: Buffer.from('img'), mimetype: 'image/jpeg' }];
    await useCase.execute('prod-1', files, 'var-1');

    expect(mockVariantRepo.findById).toHaveBeenCalledWith('var-1');
    expect(mockProductRepo.addAssets).toHaveBeenCalledWith({
      productId: 'prod-1',
      variantId: 'var-1',
      uploads: expect.any(Array),
    });
  });

  it('lanza 404 si el producto no existe', async () => {
    mockProductRepo.findById.mockResolvedValue(null);

    const files = [{ buffer: Buffer.from('img'), mimetype: 'image/jpeg' }];

    await expect(useCase.execute('prod-x', files)).rejects.toThrow(
      expect.objectContaining({ statusCode: 404 }),
    );
    expect(mockFileStorage.uploadBuffer).not.toHaveBeenCalled();
  });

  it('lanza 400 si no se envían archivos', async () => {
    const product = makeProduct();
    mockProductRepo.findById.mockResolvedValue(product);

    await expect(useCase.execute('prod-1', [])).rejects.toThrow(
      expect.objectContaining({ statusCode: 400 }),
    );
  });

  it('lanza 404 si la variante no existe', async () => {
    const product = makeProduct();
    mockProductRepo.findById.mockResolvedValue(product);
    mockVariantRepo.findById.mockResolvedValue(null);

    const files = [{ buffer: Buffer.from('img'), mimetype: 'image/jpeg' }];

    await expect(useCase.execute('prod-1', files, 'var-x')).rejects.toThrow(
      expect.objectContaining({ statusCode: 404 }),
    );
    expect(mockFileStorage.uploadBuffer).not.toHaveBeenCalled();
  });

  it('lanza 400 si la variante no pertenece al producto', async () => {
    const product = makeProduct();
    const variant = makeVariant({ id: 'var-1', productId: 'prod-otro' });
    mockProductRepo.findById.mockResolvedValue(product);
    mockVariantRepo.findById.mockResolvedValue(variant);

    const files = [{ buffer: Buffer.from('img'), mimetype: 'image/jpeg' }];

    await expect(useCase.execute('prod-1', files, 'var-1')).rejects.toThrow(
      expect.objectContaining({ statusCode: 400 }),
    );
    expect(mockFileStorage.uploadBuffer).not.toHaveBeenCalled();
  });

  it('sube múltiples archivos en paralelo', async () => {
    const product = makeProduct();
    mockProductRepo.findById.mockResolvedValue(product);
    mockFileStorage.uploadBuffer
      .mockResolvedValueOnce({ url: 'https://cloudinary.com/a.jpg', publicId: 'a' })
      .mockResolvedValueOnce({ url: 'https://cloudinary.com/b.jpg', publicId: 'b' });
    mockProductRepo.addAssets.mockResolvedValue(product);

    const files = [
      { buffer: Buffer.from('a'), mimetype: 'image/jpeg' },
      { buffer: Buffer.from('b'), mimetype: 'image/png' },
    ];
    await useCase.execute('prod-1', files);

    expect(mockFileStorage.uploadBuffer).toHaveBeenCalledTimes(2);
    expect(mockProductRepo.addAssets).toHaveBeenCalledWith(
      expect.objectContaining({
        uploads: [
          { url: 'https://cloudinary.com/a.jpg', publicId: 'a' },
          { url: 'https://cloudinary.com/b.jpg', publicId: 'b' },
        ],
      }),
    );
  });
});

// ─── DeleteProductAssetUseCase ───────────────────────────────────────────────

describe('DeleteProductAssetUseCase', () => {
  let useCase: DeleteProductAssetUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new DeleteProductAssetUseCase(mockProductRepo, mockFileStorage);
  });

  it('elimina el asset de Cloudinary y de la BD', async () => {
    const product = makeProduct();
    const asset = makeAsset({ id: 'asset-1', productId: 'prod-1' });
    mockProductRepo.findById.mockResolvedValue(product);
    mockProductRepo.findAssetById.mockResolvedValue(asset);
    mockProductRepo.countAssetsByCloudinaryPublicId.mockResolvedValue(1);
    mockFileStorage.deleteFile.mockResolvedValue(true);
    mockProductRepo.removeAsset.mockResolvedValue(product);

    const result = await useCase.execute('prod-1', 'asset-1');

    expect(mockProductRepo.countAssetsByCloudinaryPublicId).toHaveBeenCalledWith('products/test');
    expect(mockFileStorage.deleteFile).toHaveBeenCalledWith('products/test');
    expect(mockProductRepo.removeAsset).toHaveBeenCalledWith('prod-1', 'asset-1');
    expect(result).toBe(product);
  });

  it('no llama a Cloudinary destroy si otra fila reutiliza el mismo publicId', async () => {
    const product = makeProduct();
    const asset = makeAsset({ id: 'asset-1', productId: 'prod-1' });
    mockProductRepo.findById.mockResolvedValue(product);
    mockProductRepo.findAssetById.mockResolvedValue(asset);
    mockProductRepo.countAssetsByCloudinaryPublicId.mockResolvedValue(2);
    mockProductRepo.removeAsset.mockResolvedValue(product);

    await useCase.execute('prod-1', 'asset-1');

    expect(mockFileStorage.deleteFile).not.toHaveBeenCalled();
    expect(mockProductRepo.removeAsset).toHaveBeenCalledWith('prod-1', 'asset-1');
  });

  it('lanza 404 si el producto no existe', async () => {
    mockProductRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('prod-x', 'asset-1')).rejects.toThrow(
      expect.objectContaining({ statusCode: 404 }),
    );
    expect(mockFileStorage.deleteFile).not.toHaveBeenCalled();
  });

  it('lanza 404 si el asset no existe', async () => {
    const product = makeProduct();
    mockProductRepo.findById.mockResolvedValue(product);
    mockProductRepo.findAssetById.mockResolvedValue(null);

    await expect(useCase.execute('prod-1', 'asset-x')).rejects.toThrow(
      expect.objectContaining({ statusCode: 404 }),
    );
    expect(mockFileStorage.deleteFile).not.toHaveBeenCalled();
  });

  it('lanza 400 si el asset no pertenece al producto', async () => {
    const product = makeProduct();
    const asset = makeAsset({ id: 'asset-1', productId: 'prod-otro' });
    mockProductRepo.findById.mockResolvedValue(product);
    mockProductRepo.findAssetById.mockResolvedValue(asset);

    await expect(useCase.execute('prod-1', 'asset-1')).rejects.toThrow(
      expect.objectContaining({ statusCode: 400 }),
    );
    expect(mockFileStorage.deleteFile).not.toHaveBeenCalled();
  });
});

// ─── ReuseProductAssetsForVariantUseCase ────────────────────────────────────

describe('ReuseProductAssetsForVariantUseCase', () => {
  let useCase: ReuseProductAssetsForVariantUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new ReuseProductAssetsForVariantUseCase(mockProductRepo, mockVariantRepo);
  });

  it('delega en reuseGeneralAssetsForVariant con ids de assets generales', async () => {
    const product = makeProduct();
    const variant = makeVariant({ id: 'var-1', productId: 'prod-1' });
    mockProductRepo.findById.mockResolvedValue(product);
    mockVariantRepo.findById.mockResolvedValue(variant);
    mockProductRepo.reuseGeneralAssetsForVariant.mockResolvedValue(product);

    const [, dto] = ReuseProductAssetsDto.create({
      variantId: 'var-1',
      assetIds: ['a1', 'a2'],
    });
    const result = await useCase.execute('prod-1', dto!);

    expect(mockProductRepo.reuseGeneralAssetsForVariant).toHaveBeenCalledWith({
      productId: 'prod-1',
      variantId: 'var-1',
      sourceAssetIds: ['a1', 'a2'],
    });
    expect(result).toBe(product);
  });
});

describe('ReuseProductAssetsDto', () => {
  it('rechaza duplicados en assetIds', () => {
    const [err] = ReuseProductAssetsDto.create({
      variantId: 'v1',
      assetIds: ['x', 'x'],
    });
    expect(err).toContain('duplicados');
  });
});
