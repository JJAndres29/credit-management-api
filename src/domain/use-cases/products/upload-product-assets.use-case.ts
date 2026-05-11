import { CustomError } from '../../errors';
import { ProductEntity } from '../../entities';
import { ProductRepository } from '../../repositories';
import type { VariantRepository } from '../../repositories/variant.repository';
import { FileStorageService } from '../../services/file-storage.service';

interface AssetFile {
  buffer: Buffer;
  mimetype: string;
}

export class UploadProductAssetsUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly variantRepository: VariantRepository,
    private readonly fileStorageService: FileStorageService,
  ) {}

  async execute(
    productId: string,
    files: AssetFile[],
    variantId?: string,
  ): Promise<ProductEntity> {
    const product = await this.productRepository.findById(productId);
    if (!product) throw CustomError.notFound(`Producto ${productId} no encontrado`);

    if (files.length === 0) {
      throw CustomError.badRequest('Debe enviar al menos una imagen');
    }

    let resolvedVariantId: string | null = null;

    if (variantId) {
      const variant = await this.variantRepository.findById(variantId);
      if (!variant) {
        throw CustomError.notFound(`Variante ${variantId} no encontrada`);
      }
      if (variant.productId !== productId) {
        throw CustomError.badRequest('La variante no pertenece a este producto');
      }
      resolvedVariantId = variantId;
    }

    const uploads = await Promise.all(
      files.map((file) =>
        this.fileStorageService.uploadBuffer(file.buffer, file.mimetype, 'products'),
      ),
    );

    return this.productRepository.addAssets({
      productId,
      variantId: resolvedVariantId,
      uploads,
    });
  }
}
