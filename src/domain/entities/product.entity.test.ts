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

describe('ProductEntity.toJSON', () => {
  it('expone atributos como strings escalares (no { attribute: { name } })', () => {
    const entity = new ProductEntity(
      'prod-1',
      'Sabana',
      null,
      4,
      null,
      null,
      null,
      [],
      'cat-1',
      'Sabanas',
      [
        { attribute: 'Color', value: 'Rojo' },
        { attribute: 'Tamaño', value: 'Queen' },
      ],
      true,
      new Date('2026-01-01'),
      new Date('2026-01-02'),
    );
    const json = entity.toJSON();
    expect(json.attributes).toEqual([
      { attribute: 'Color', value: 'Rojo' },
      { attribute: 'Tamaño', value: 'Queen' },
    ]);
    expect(json.categoryName).toBe('Sabanas');
    for (const a of json.attributes) {
      expect(typeof a.attribute).toBe('string');
    }
  });
});
