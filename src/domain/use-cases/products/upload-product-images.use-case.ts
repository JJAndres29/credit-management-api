import { CustomError } from '../../errors';
import { ProductEntity } from '../../entities';
import { ProductRepository } from '../../repositories';
import { FileStorageService } from '../../services/file-storage.service';

interface ImageFile {
  buffer: Buffer;
  mimetype: string;
}

export class UploadProductImagesUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly fileStorageService: FileStorageService,
  ) {}

  async execute(productId: string, files: ImageFile[]): Promise<ProductEntity> {
    const product = await this.productRepository.findById(productId);

    if (!product) throw CustomError.notFound(`Product with id ${productId} not found`);

    if (files.length === 0) throw CustomError.badRequest('Debe enviar al menos una imagen');

    const uploads = await Promise.all(
      files.map((file) =>
        this.fileStorageService.uploadBuffer(file.buffer, file.mimetype, 'products'),
      ),
    );

    return this.productRepository.addImages(productId, uploads);
  }
}
