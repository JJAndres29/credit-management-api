import { prisma } from '../../config/prisma';
import type {
  CategoryCreateData,
  CategoryUpdateData,
} from '../../domain/datasources/category.datasource';
import { CategoryDatasource } from '../../domain/datasources/category.datasource';
import { CategoryEntity, CategoryAttributeEntity, AttributeValueEntity } from '../../domain/entities';
import { CustomError } from '../../domain/errors';
import { isValidSlugFormat, slugify } from '../../domain/services/slug';

async function ensureUniqueCategorySlug(candidate: string, excludeId?: string): Promise<string> {
  let s = candidate;
  for (let n = 0; n < 500; n += 1) {
    const clash = await prisma.category.findFirst({
      where: {
        slug: s,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    if (!clash) return s;
    s = `${candidate}-${n + 2}`;
  }
  throw new Error('No se pudo generar slug único para categoría');
}

export class PrismaCategoryDatasource implements CategoryDatasource {
  async create(data: CategoryCreateData): Promise<CategoryEntity> {
    const requested = data.slug?.trim() ?? null;
    const base = requested && isValidSlugFormat(requested)
      ? requested
      : slugify(data.name);

    let slug: string;
    if (requested) {
      const taken = await prisma.category.findFirst({ where: { slug: requested } });
      if (taken) throw CustomError.conflict('Slug de categoría ya en uso');
      slug = requested;
    } else {
      slug = await ensureUniqueCategorySlug(base);
    }

    const category = await prisma.category.create({
      data: {
        name: data.name,
        slug,
        description: data.description ?? null,
        metaTitle: data.metaTitle ?? null,
        metaDescription: data.metaDescription ?? null,
      },
    });
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

  async update(id: string, data: CategoryUpdateData): Promise<CategoryEntity> {
    if (data.slug !== undefined && data.slug !== null) {
      const s = data.slug.trim();
      if (!isValidSlugFormat(s)) {
        throw CustomError.badRequest('slug inválido');
      }
      const taken = await prisma.category.findFirst({
        where: { slug: s, id: { not: id } },
      });
      if (taken) throw CustomError.conflict('Slug de categoría ya en uso');
    }

    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.slug !== undefined && { slug: data.slug }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.metaTitle !== undefined && { metaTitle: data.metaTitle }),
        ...(data.metaDescription !== undefined && { metaDescription: data.metaDescription }),
      },
    });
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
