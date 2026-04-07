import { CustomError } from '../../errors';
import { ProductEntity } from '../../entities';
import { ProductRepository } from '../../repositories';
import { FileStorageService } from '../../services/file-storage.service';

export class DeleteProductImageUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly fileStorageService: FileStorageService,
  ) {}

  async execute(productId: string, imageId: string): Promise<ProductEntity> {
    const product = await this.productRepository.findById(productId);

    if (!product) throw CustomError.notFound(`Product with id ${productId} not found`);

    const image = product.images.find((img) => img.id === imageId);

    if (!image) throw CustomError.notFound(`Image with id ${imageId} not found in this product`);

    await this.fileStorageService.deleteFile(image.publicId);

    return this.productRepository.removeImage(productId, imageId);
  }
}
