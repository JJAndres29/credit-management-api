import { CustomError } from '../../errors';
import { ProductEntity } from '../../entities';
import { ProductRepository } from '../../repositories';

export class AdjustStockUseCase {
  constructor(private readonly productRepository: ProductRepository) {}

  async execute(id: string, quantity: number): Promise<ProductEntity> {
    const product = await this.productRepository.findById(id);

    if (!product) throw CustomError.notFound(`Product with id ${id} not found`);

    const newStock = product.stock + quantity;

    if (newStock < 0) {
      throw CustomError.badRequest(
        `Stock insuficiente. Stock actual: ${product.stock}, ajuste solicitado: ${quantity}`,
      );
    }

    return this.productRepository.adjustStock(id, quantity);
  }
}
