import type { CategoryCreateData, CategoryUpdateData } from '../datasources/category.datasource';
import { CategoryEntity, CategoryAttributeEntity, AttributeValueEntity } from '../entities';

export interface CategoryRepository {
  create(data: CategoryCreateData): Promise<CategoryEntity>;
  findAll(): Promise<CategoryEntity[]>;
  findById(id: string): Promise<CategoryEntity | null>;
  update(id: string, data: CategoryUpdateData): Promise<CategoryEntity>;
  delete(id: string): Promise<CategoryEntity>;

  createAttribute(categoryId: string, name: string): Promise<CategoryAttributeEntity>;
  findAttributeById(id: string): Promise<CategoryAttributeEntity | null>;
  updateAttribute(id: string, name: string): Promise<CategoryAttributeEntity>;
  findAttributesByCategory(categoryId: string): Promise<CategoryAttributeEntity[]>;
  deleteAttribute(id: string): Promise<CategoryAttributeEntity>;

  createValue(attributeId: string, value: string): Promise<AttributeValueEntity>;
  findValueById(id: string): Promise<AttributeValueEntity | null>;
  updateValue(id: string, value: string): Promise<AttributeValueEntity>;
  findValuesByAttribute(attributeId: string): Promise<AttributeValueEntity[]>;
  deleteValue(id: string): Promise<AttributeValueEntity>;

  areValuesFromCategory(categoryId: string, valueIds: string[]): Promise<boolean>;
}
