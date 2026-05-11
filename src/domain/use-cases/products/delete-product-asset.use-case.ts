import { CustomError } from '../../errors';
import { ProductEntity } from '../../entities';
import { ProductRepository } from '../../repositories';
import { FileStorageService } from '../../services/file-storage.service';

export class DeleteProductAssetUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly fileStorageService: FileStorageService,
  ) {}

  async execute(productId: string, assetId: string): Promise<ProductEntity> {
    const product = await this.productRepository.findById(productId);
    if (!product) throw CustomError.notFound(`Producto ${productId} no encontrado`);

    const asset = await this.productRepository.findAssetById(assetId);
    if (!asset) {
      throw CustomError.notFound(`Asset ${assetId} no encontrado`);
    }

    if (asset.productId !== productId) {
      throw CustomError.badRequest('El asset no pertenece a este producto');
    }

    await this.fileStorageService.deleteFile(asset.cloudinaryPublicId);

    return this.productRepository.removeAsset(productId, assetId);
  }
}
