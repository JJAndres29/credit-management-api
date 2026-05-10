import { prisma } from '../../config/prisma';
import { ProductDatasource } from '../../domain/datasources';
import { ProductEntity } from '../../domain/entities';
import { CreateProductDto, UpdateProductDto, FilterProductsDto } from '../../domain/dtos/products';
import { UploadResult } from '../../domain/services/file-storage.service';
import { PaginationDto } from '../../domain/dtos/shared';
import { PaginatedResult } from '../../domain/types/paginated.type';

const includeImages = {
  images: {
    orderBy: { order: 'asc' as const },
  },
  category: true,
  attributes: {
    include: {
      value: {
        include: {
          attribute: true,
        },
      },
    },
  },
};

function buildWhere(filters: FilterProductsDto) {
  const stockFilter: Record<string, unknown> = {};
  if (filters.minStock !== undefined) stockFilter.gte = filters.minStock;
  if (filters.maxStock !== undefined) stockFilter.lte = filters.maxStock;

  // inStock overrides minStock/maxStock when present
  if (filters.inStock === true) stockFilter.gt = 0;
  else if (filters.inStock === false) stockFilter.equals = 0;

  return {
    isActive: true,
    ...(filters.search && {
      name: { contains: filters.search, mode: 'insensitive' as const },
    }),
    ...(Object.keys(stockFilter).length > 0 && { stock: stockFilter }),
    ...(filters.categoryId && { categoryId: filters.categoryId }),
  };
}

export class PrismaProductDatasource implements ProductDatasource {
  async findAll(pagination: PaginationDto, filters: FilterProductsDto): Promise<PaginatedResult<ProductEntity>> {
    const where = buildWhere(filters);

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: includeImages,
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.product.count({ where }),
    ]);

    return {
      data: products.map((p) => ProductEntity.fromObject(p as unknown as Record<string, unknown>)),
      pagination: {
        total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(total / pagination.limit),
        hasNextPage: pagination.page * pagination.limit < total,
        hasPrevPage: pagination.page > 1,
      },
    };
  }

  async findById(id: string): Promise<ProductEntity | null> {
    const product = await prisma.product.findFirst({
      where: { id, isActive: true },
      include: includeImages,
    });

    if (!product) return null;

    return ProductEntity.fromObject(product as unknown as Record<string, unknown>);
  }

  async create(dto: CreateProductDto): Promise<ProductEntity> {
    const product = await prisma.$transaction(async (tx) => {
      const p = await tx.product.create({
        data: {
          name: dto.name,
          description: dto.description,
          stock: dto.stock,
          categoryId: dto.categoryId,
          ...(dto.investmentCost !== undefined && { investmentCost: dto.investmentCost }),
        },
      });

      await tx.productVariant.create({
        data: {
          productId: p.id,
          label: 'Default',
          stock: p.stock,
          retailPrice: p.retailPrice,
          investmentCost: p.investmentCost,
          currencyCode: p.currencyCode,
          isDefault: true,
          isActive: p.isActive,
        },
      });

      return tx.product.findUniqueOrThrow({
        where: { id: p.id },
        include: includeImages,
      });
    });

    return ProductEntity.fromObject(product as unknown as Record<string, unknown>);
  }

  async update(id: string, dto: UpdateProductDto): Promise<ProductEntity> {
    const product = await prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
          ...(dto.investmentCost !== undefined && { investmentCost: dto.investmentCost }),
        },
      });

      if (dto.categoryId !== undefined) {
        if (dto.categoryId === null) {
          await tx.productAttribute.deleteMany({ where: { productId: id } });
        } else {
          await tx.productAttribute.deleteMany({
            where: {
              productId: id,
              value: {
                attribute: {
                  categoryId: { not: dto.categoryId },
                },
              },
            },
          });
        }
      }

      return tx.product.findUniqueOrThrow({
        where: { id: updated.id },
        include: includeImages,
      });
    });

    return ProductEntity.fromObject(product as unknown as Record<string, unknown>);
  }

  async adjustStock(id: string, quantity: number): Promise<ProductEntity> {
    const product = await prisma.$transaction(async (tx) => {
      const p = await tx.product.update({
        where: { id },
        data: { stock: { increment: quantity } },
      });

      await tx.productVariant.updateMany({
        where: { productId: id, isDefault: true },
        data: { stock: { increment: quantity } },
      });

      return tx.product.findUniqueOrThrow({
        where: { id: p.id },
        include: includeImages,
      });
    });

    return ProductEntity.fromObject(product as unknown as Record<string, unknown>);
  }

  async delete(id: string): Promise<ProductEntity> {
    const product = await prisma.product.update({
      where: { id },
      data: { isActive: false },
      include: includeImages,
    });

    return ProductEntity.fromObject(product as unknown as Record<string, unknown>);
  }

  async addImages(productId: string, images: UploadResult[]): Promise<ProductEntity> {
    const currentCount = await prisma.productImage.count({ where: { productId } });

    await prisma.productImage.createMany({
      data: images.map((img, index) => ({
        productId,
        url: img.url,
        publicId: img.publicId,
        order: currentCount + index,
      })),
    });

    const product = await prisma.product.findUniqueOrThrow({
      where: { id: productId },
      include: includeImages,
    });

    return ProductEntity.fromObject(product as unknown as Record<string, unknown>);
  }

  async removeImage(productId: string, imageId: string): Promise<ProductEntity> {
    await prisma.productImage.delete({ where: { id: imageId } });

    const product = await prisma.product.findUniqueOrThrow({
      where: { id: productId },
      include: includeImages,
    });

    return ProductEntity.fromObject(product as unknown as Record<string, unknown>);
  }

  async updateRetailPrice(id: string, retailPrice: number | null): Promise<ProductEntity> {
    const product = await prisma.product.update({
      where: { id },
      data: { retailPrice },
      include: includeImages,
    });

    return ProductEntity.fromObject(product as unknown as Record<string, unknown>);
  }

  async assignAttributes(productId: string, valueIds: string[]): Promise<ProductEntity> {
    await prisma.productAttribute.createMany({
      data: valueIds.map((valueId) => ({ productId, valueId })),
      skipDuplicates: true,
    });

    const product = await prisma.product.findUniqueOrThrow({
      where: { id: productId },
      include: includeImages,
    });

    return ProductEntity.fromObject(product as unknown as Record<string, unknown>);
  }

  async replaceAttributes(productId: string, valueIds: string[]): Promise<ProductEntity> {
    await prisma.$transaction(async (tx) => {
      await tx.productAttribute.deleteMany({ where: { productId } });

      if (valueIds.length > 0) {
        await tx.productAttribute.createMany({
          data: valueIds.map((valueId) => ({ productId, valueId })),
          skipDuplicates: true,
        });
      }
    });

    const product = await prisma.product.findUniqueOrThrow({
      where: { id: productId },
      include: includeImages,
    });

    return ProductEntity.fromObject(product as unknown as Record<string, unknown>);
  }

  async removeAttribute(productId: string, valueId: string): Promise<ProductEntity> {
    await prisma.productAttribute.deleteMany({
      where: { productId, valueId },
    });

    const product = await prisma.product.findUniqueOrThrow({
      where: { id: productId },
      include: includeImages,
    });

    return ProductEntity.fromObject(product as unknown as Record<string, unknown>);
  }
}
