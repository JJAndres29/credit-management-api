import { FilterProductsDto } from './filter-products.dto';

describe('FilterProductsDto.create', () => {
  it('crea DTO sin filtros', () => {
    const [error, dto] = FilterProductsDto.create({});
    expect(error).toBeUndefined();
    expect(dto).toBeDefined();
    expect(dto!.categoryId).toBeUndefined();
  });

  it('acepta categoryId UUID v4 válido', () => {
    const validUuid = '550e8400-e29b-41d4-a716-446655440000';
    const [error, dto] = FilterProductsDto.create({ categoryId: validUuid });
    expect(error).toBeUndefined();
    expect(dto!.categoryId).toBe(validUuid);
  });

  it('rechaza categoryId que no es UUID v4', () => {
    const [error] = FilterProductsDto.create({ categoryId: 'not-a-uuid' });
    expect(error).toBe('categoryId debe ser un UUID v4 válido');
  });

  it('rechaza categoryId UUID v1 (no v4)', () => {
    const [error] = FilterProductsDto.create({ categoryId: '550e8400-e29b-11d4-a716-446655440000' });
    expect(error).toBe('categoryId debe ser un UUID v4 válido');
  });

  it('omite categoryId cuando no se provee', () => {
    const [error, dto] = FilterProductsDto.create({ search: 'camisa' });
    expect(error).toBeUndefined();
    expect(dto!.categoryId).toBeUndefined();
    expect(dto!.search).toBe('camisa');
  });
});
