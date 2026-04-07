import { prisma } from '../../config/prisma';
import { ProductDatasource } from '../../domain/datasources';
import { ProductEntity } from '../../domain/entities';
import { CreateProductDto, UpdateProductDto } from '../../domain/dtos/products';
import { UploadResult } from '../../domain/services/file-storage.service';

const includeImages = {
  images: {
    orderBy: { order: 'asc' as const },
  },
};

export class PrismaProductDatasource implements ProductDatasource {
  async findAll(): Promise<ProductEntity[]> {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      include: includeImages,
    });

    return products.map((p) => ProductEntity.fromObject(p as unknown as Record<string, unknown>));
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
