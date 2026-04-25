import { CategoryDatasource } from '../../domain/datasources';
import { CategoryRepository } from '../../domain/repositories';
import { CategoryEntity, CategoryAttributeEntity, AttributeValueEntity } from '../../domain/entities';

export class CategoryRepositoryImpl implements CategoryRepository {
  constructor(private readonly datasource: CategoryDatasource) {}

  create(name: string): Promise<CategoryEntity> {
    return this.datasource.create(name);
  }

  findAll(): Promise<CategoryEntity[]> {
    return this.datasource.findAll();
  }

  findById(id: string): Promise<CategoryEntity | null> {
    return this.datasource.findById(id);
  }

  update(id: string, name: string): Promise<CategoryEntity> {
    return this.datasource.update(id, name);
  }

  delete(id: string): Promise<CategoryEntity> {
    return this.datasource.delete(id);
  }

  createAttribute(categoryId: string, name: string): Promise<CategoryAttributeEntity> {
    return this.datasource.createAttribute(categoryId, name);
  }

  findAttributeById(id: string): Promise<CategoryAttributeEntity | null> {
    return this.datasource.findAttributeById(id);
  }

  updateAttribute(id: string, name: string): Promise<CategoryAttributeEntity> {
    return this.datasource.updateAttribute(id, name);
  }

  findAttributesByCategory(categoryId: string): Promise<CategoryAttributeEntity[]> {
    return this.datasource.findAttributesByCategory(categoryId);
  }

  deleteAttribute(id: string): Promise<CategoryAttributeEntity> {
    return this.datasource.deleteAttribute(id);
  }

  createValue(attributeId: string, value: string): Promise<AttributeValueEntity> {
    return this.datasource.createValue(attributeId, value);
  }

  findValueById(id: string): Promise<AttributeValueEntity | null> {
    return this.datasource.findValueById(id);
  }

  updateValue(id: string, value: string): Promise<AttributeValueEntity> {
    return this.datasource.updateValue(id, value);
  }

  findValuesByAttribute(attributeId: string): Promise<AttributeValueEntity[]> {
    return this.datasource.findValuesByAttribute(attributeId);
  }

  deleteValue(id: string): Promise<AttributeValueEntity> {
    return this.datasource.deleteValue(id);
  }

  areValuesFromCategory(categoryId: string, valueIds: string[]): Promise<boolean> {
    return this.datasource.areValuesFromCategory(categoryId, valueIds);
  }
}
