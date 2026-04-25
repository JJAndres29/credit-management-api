import { ProductRepository } from '../../repositories';
import { ProductEntity } from '../../entities';
import { CustomError } from '../../errors';

export class UpdateRetailPriceUseCase {
  constructor(private readonly productRepository: ProductRepository) {}

  async execute(id: string, retailPrice: number | null): Promise<ProductEntity> {
    const product = await this.productRepository.findById(id);
    if (!product) throw CustomError.notFound('Producto no encontrado');

    return this.productRepository.updateRetailPrice(id, retailPrice);
  }
}
