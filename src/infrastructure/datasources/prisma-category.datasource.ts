import { prisma } from '../../config/prisma';
import { CategoryDatasource } from '../../domain/datasources';
import { CategoryEntity, CategoryAttributeEntity, AttributeValueEntity } from '../../domain/entities';

export class PrismaCategoryDatasource implements CategoryDatasource {
  async create(name: string): Promise<CategoryEntity> {
    const category = await prisma.category.create({ data: { name } });
    return CategoryEntity.fromObject(category as unknown as Record<string, unknown>);
  }

  async findAll(): Promise<CategoryEntity[]> {
    const categories = await prisma.category.findMany({ orderBy: { createdAt: 'desc' } });
    return categories.map((c) => CategoryEntity.fromObject(c as unknown as Record<string, unknown>));
  }

  async findById(id: string): Promise<CategoryEntity | null> {
    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) return null;
    return CategoryEntity.fromObject(category as unknown as Record<string, unknown>);
  }

  async update(id: string, name: string): Promise<CategoryEntity> {
    const category = await prisma.category.update({ where: { id }, data: { name } });
    return CategoryEntity.fromObject(category as unknown as Record<string, unknown>);
  }

  async delete(id: string): Promise<CategoryEntity> {
    const category = await prisma.category.delete({ where: { id } });
    return CategoryEntity.fromObject(category as unknown as Record<string, unknown>);
  }

  async createAttribute(categoryId: string, name: string): Promise<CategoryAttributeEntity> {
    const attribute = await prisma.categoryAttribute.create({ data: { categoryId, name } });
    return CategoryAttributeEntity.fromObject(attribute as unknown as Record<string, unknown>);
  }

  async findAttributeById(id: string): Promise<CategoryAttributeEntity | null> {
    const attribute = await prisma.categoryAttribute.findUnique({ where: { id } });
    if (!attribute) return null;
    return CategoryAttributeEntity.fromObject(attribute as unknown as Record<string, unknown>);
  }

  async updateAttribute(id: string, name: string): Promise<CategoryAttributeEntity> {
    const attribute = await prisma.categoryAttribute.update({ where: { id }, data: { name } });
    return CategoryAttributeEntity.fromObject(attribute as unknown as Record<string, unknown>);
  }

  async findAttributesByCategory(categoryId: string): Promise<CategoryAttributeEntity[]> {
    const attributes = await prisma.categoryAttribute.findMany({
      where: { categoryId },
      orderBy: { createdAt: 'asc' },
    });
    return attributes.map((a) => CategoryAttributeEntity.fromObject(a as unknown as Record<string, unknown>));
  }

  async deleteAttribute(id: string): Promise<CategoryAttributeEntity> {
    const attribute = await prisma.categoryAttribute.delete({ where: { id } });
    return CategoryAttributeEntity.fromObject(attribute as unknown as Record<string, unknown>);
  }

  async createValue(attributeId: string, value: string): Promise<AttributeValueEntity> {
    const created = await prisma.attributeValue.create({ data: { attributeId, value } });
    return AttributeValueEntity.fromObject(created as unknown as Record<string, unknown>);
  }

  async findValueById(id: string): Promise<AttributeValueEntity | null> {
    const value = await prisma.attributeValue.findUnique({ where: { id } });
    if (!value) return null;
    return AttributeValueEntity.fromObject(value as unknown as Record<string, unknown>);
  }

  async updateValue(id: string, value: string): Promise<AttributeValueEntity> {
    const updated = await prisma.attributeValue.update({ where: { id }, data: { value } });
    return AttributeValueEntity.fromObject(updated as unknown as Record<string, unknown>);
  }

  async findValuesByAttribute(attributeId: string): Promise<AttributeValueEntity[]> {
    const values = await prisma.attributeValue.findMany({
      where: { attributeId },
      orderBy: { createdAt: 'asc' },
    });
    return values.map((v) => AttributeValueEntity.fromObject(v as unknown as Record<string, unknown>));
  }

  async deleteValue(id: string): Promise<AttributeValueEntity> {
    const value = await prisma.attributeValue.delete({ where: { id } });
    return AttributeValueEntity.fromObject(value as unknown as Record<string, unknown>);
  }

  async areValuesFromCategory(categoryId: string, valueIds: string[]): Promise<boolean> {
    const total = valueIds.length;
    if (total === 0) return true;

    const matchingCount = await prisma.attributeValue.count({
      where: {
        id: { in: valueIds },
        attribute: { categoryId },
      },
    });

    return matchingCount === total;
  }
}
