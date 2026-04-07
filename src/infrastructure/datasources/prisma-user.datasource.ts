import { prisma } from '../../config/prisma';
import { UserDatasource } from '../../domain/datasources';
import { UserEntity } from '../../domain/entities';
import { CreateUserDto, UpdateUserDto } from '../../domain/dtos';

export class PrismaUserDatasource implements UserDatasource {

  async findAll(): Promise<UserEntity[]> {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return users.map((user) =>
      UserEntity.fromObject(user as unknown as Record<string, unknown>),
    );
  }

  async findById(id: string): Promise<UserEntity | null> {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return null;
    return UserEntity.fromObject(user as unknown as Record<string, unknown>);
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return null;
    return UserEntity.fromObject(user as unknown as Record<string, unknown>);
  }

  async create(dto: CreateUserDto, hashedPassword: string): Promise<UserEntity> {
    const user = await prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
        role: dto.role,
      },
    });

    return UserEntity.fromObject(user as unknown as Record<string, unknown>);
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserEntity> {
    const user = await prisma.user.update({
      where: { id },
      data: {
        name: dto.name,
        email: dto.email,
        role: dto.role,
      },
    });

    return UserEntity.fromObject(user as unknown as Record<string, unknown>);
  }

  async toggleStatus(id: string, isActive: boolean): Promise<UserEntity> {
    const user = await prisma.user.update({
      where: { id },
      data: { isActive },
    });

    return UserEntity.fromObject(user as unknown as Record<string, unknown>);
  }

  async changePassword(id: string, hashedPassword: string): Promise<UserEntity> {
    const user = await prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });

    return UserEntity.fromObject(user as unknown as Record<string, unknown>);
  }
}
