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
};

function buildWhere(filters: FilterProductsDto) {
  const priceFilter: Record<string, unknown> = {};
  if (filters.minPrice !== undefined) priceFilter.gte = filters.minPrice;
  if (filters.maxPrice !== undefined) priceFilter.lte = filters.maxPrice;

  const stockFilter: Record<string, unknown> = {};
  if (filters.minStock !== undefined) stockFilter.gte = filters.minStock;
  if (filters.maxStock !== undefined) stockFilter.lte = filters.maxStock;

  return {
    isActive: true,
    ...(filters.search && {
      name: { contains: filters.search, mode: 'insensitive' as const },
    }),
    ...(Object.keys(priceFilter).length > 0 && { price: priceFilter }),
    ...(Object.keys(stockFilter).length > 0 && { stock: stockFilter }),
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
    const product = await prisma.product.create({
      data: {
        name: dto.name,
        price: dto.price,
        stock: dto.stock,
      },
      include: includeImages,
    });

    return ProductEntity.fromObject(product as unknown as Record<string, unknown>);
  }

  async update(id: string, dto: UpdateProductDto): Promise<ProductEntity> {
    const product = await prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        price: dto.price,
      },
      include: includeImages,
    });

    return ProductEntity.fromObject(product as unknown as Record<string, unknown>);
  }

  async adjustStock(id: string, quantity: number): Promise<ProductEntity> {
    const product = await prisma.product.update({
      where: { id },
      data: { stock: { increment: quantity } },
      include: includeImages,
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
}
