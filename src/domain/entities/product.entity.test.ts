import { ProductEntity } from './product.entity';

describe('ProductEntity.fromObject', () => {
  it('mapea atributos dinámicos para GET /products/:id', () => {
    const entity = ProductEntity.fromObject({
      id: 'prod-1',
      name: 'Sabana',
      stock: 4,
      images: [],
      categoryId: 'cat-1',
      category: { id: 'cat-1', name: 'Sabanas' },
      attributes: [
        {
          value: {
            value: 'Rojo',
            attribute: { name: 'Color' },
          },
        },
        {
          value: {
            value: 'Queen',
            attribute: { name: 'Tamano' },
          },
        },
      ],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(entity.attributes).toEqual([
      { attribute: 'Color', value: 'Rojo' },
      { attribute: 'Tamano', value: 'Queen' },
    ]);
    expect(entity.categoryId).toBe('cat-1');
  });
});
