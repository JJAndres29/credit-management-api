import { CustomError } from '../../errors';
import { ProductEntity } from '../../entities';
import { CategoryRepository, ProductRepository } from '../../repositories';

export class ReplaceProductAttributesUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly categoryRepository: CategoryRepository,
  ) {}

  async execute(productId: string, valueIds: string[]): Promise<ProductEntity> {
    const product = await this.productRepository.findById(productId);
    if (!product) throw CustomError.notFound(`Product with id ${productId} not found`);
    if (!product.categoryId) throw CustomError.badRequest('El producto no tiene categoría asignada');

    const areValid = await this.categoryRepository.areValuesFromCategory(product.categoryId, valueIds);
    if (!areValid) {
      throw CustomError.badRequest('No puedes asignar valores de una categoría diferente al producto');
    }

    return this.productRepository.replaceAttributes(productId, valueIds);
  }
}
