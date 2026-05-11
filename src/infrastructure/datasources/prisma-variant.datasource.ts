import { createHash } from 'crypto';
import { prisma } from '../../config/prisma';
import { VariantDatasource, VariantCreateData, VariantUpdateData } from '../../domain/datasources/variant.datasource';
import { ProductVariantEntity } from '../../domain/entities';
import { CustomError } from '../../domain/errors';

const VARIANT_INCLUDE = {
  attributeValues: {
    include: {
      value: {
        include: {
          attribute: true,
        },
      },
    },
  },
} as const;

function computeAttributeHash(valueIds: string[]): string {
  const sorted = [...valueIds].sort();
  return createHash('sha256').update(sorted.join(':')).digest('hex');
}

function mapToEntity(row: Record<string, unknown>): ProductVariantEntity {
  return ProductVariantEntity.fromObject(row);
}

export class PrismaVariantDatasource implements VariantDatasource {
  async findByProductId(productId: string): Promise<ProductVariantEntity[]> {
    const variants = await prisma.productVariant.findMany({
      where: { productId },
      include: VARIANT_INCLUDE,
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });

    return variants.map((v) => mapToEntity(v as unknown as Record<string, unknown>));
  }

  async findById(id: string): Promise<ProductVariantEntity | null> {
    const variant = await prisma.productVariant.findUnique({
      where: { id },
      include: VARIANT_INCLUDE,
    });

    if (!variant) return null;
    return mapToEntity(variant as unknown as Record<string, unknown>);
  }

  async create(data: VariantCreateData): Promise<ProductVariantEntity> {
    if (data.attributeValueIds.length === 0) {
      throw CustomError.badRequest('Las variantes no-default requieren al menos un valor de atributo');
    }

    const variant = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: data.productId },
        select: { id: true, categoryId: true, currencyCode: true, isActive: true },
      });
      if (!product) throw CustomError.notFound(`Producto ${data.productId} no encontrado`);

      if (!product.categoryId) {
        throw CustomError.badRequest('El producto debe tener una categoría para crear variantes con atributos');
      }

      const values = await tx.attributeValue.findMany({
        where: { id: { in: data.attributeValueIds } },
        include: { attribute: true },
      });

      if (values.length !== data.attributeValueIds.length) {
        const found = new Set(values.map((v) => v.id));
        const missing = data.attributeValueIds.filter((id) => !found.has(id));
        throw CustomError.notFound(`Valores de atributo no encontrados: ${missing.join(', ')}`);
      }

      const wrongCategory = values.filter((v) => v.attribute.categoryId !== product.categoryId);
      if (wrongCategory.length > 0) {
        throw CustomError.badRequest(
          `Los atributos ${wrongCategory.map((v) => v.attribute.name).join(', ')} no pertenecen a la categoría del producto`,
        );
      }

      const attributeIds = values.map((v) => v.attribute.id);
      const uniqueAttributes = new Set(attributeIds);
      if (uniqueAttributes.size !== attributeIds.length) {
        throw CustomError.badRequest('No se puede asignar más de un valor del mismo atributo a una variante');
      }

      const hash = computeAttributeHash(data.attributeValueIds);

      const existing = await tx.productVariant.findFirst({
        where: { productId: data.productId, attributeHash: hash },
      });
      if (existing) {
        throw CustomError.conflict('Ya existe una variante con esta combinación de atributos para este producto');
      }

      const created = await tx.productVariant.create({
        data: {
          productId: data.productId,
          sku: data.sku ?? null,
          label: data.label ?? null,
          stock: data.stock,
          retailPrice: data.retailPrice ?? null,
          investmentCost: data.investmentCost ?? null,
          currencyCode: product.currencyCode,
          isDefault: false,
          isActive: product.isActive,
          attributeHash: hash,
          attributeValues: {
            create: data.attributeValueIds.map((valueId) => ({
              valueId,
            })),
          },
        },
        include: VARIANT_INCLUDE,
      });

      return created;
    });

    return mapToEntity(variant as unknown as Record<string, unknown>);
  }

  async update(id: string, data: VariantUpdateData): Promise<ProductVariantEntity> {
    const current = await prisma.productVariant.findUnique({ where: { id } });
    if (!current) throw CustomError.notFound(`Variante ${id} no encontrada`);

    const updateData: Record<string, unknown> = {};
    if (data.sku !== undefined) updateData.sku = data.sku;
    if (data.label !== undefined) updateData.label = data.label;
    if (data.stock !== undefined) updateData.stock = data.stock;
    if (data.retailPrice !== undefined) updateData.retailPrice = data.retailPrice;
    if (data.investmentCost !== undefined) updateData.investmentCost = data.investmentCost;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const updated = await prisma.productVariant.update({
      where: { id },
      data: updateData,
      include: VARIANT_INCLUDE,
    });

    if (current.isDefault && data.stock !== undefined) {
      await prisma.product.update({
        where: { id: current.productId },
        data: { stock: data.stock },
      });
    }

    if (current.isDefault && data.retailPrice !== undefined) {
      await prisma.product.update({
        where: { id: current.productId },
        data: { retailPrice: data.retailPrice },
      });
    }

    return mapToEntity(updated as unknown as Record<string, unknown>);
  }

  async delete(id: string): Promise<ProductVariantEntity> {
    const variant = await prisma.productVariant.findUnique({
      where: { id },
      include: VARIANT_INCLUDE,
    });
    if (!variant) throw CustomError.notFound(`Variante ${id} no encontrada`);

    if (variant.isDefault) {
      throw CustomError.badRequest('No se puede eliminar la variante default de un producto');
    }

    const hasSaleItems = await prisma.saleItem.findFirst({
      where: { variantId: id },
      select: { id: true },
    });
    if (hasSaleItems) {
      throw CustomError.badRequest('No se puede eliminar una variante con ventas registradas');
    }

    await prisma.$transaction(async (tx) => {
      await tx.variantAttributeValue.deleteMany({ where: { variantId: id } });
      await tx.productVariant.delete({ where: { id } });
    });

    return mapToEntity(variant as unknown as Record<string, unknown>);
  }
}
