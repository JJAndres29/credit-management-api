import { prisma } from '../../config/prisma';
import { AuthDatasource } from '../../domain/datasources';
import { UserEntity } from '../../domain/entities';

export class PrismaAuthDatasource implements AuthDatasource {
  async findByEmail(email: string): Promise<UserEntity | null> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return null;
    return UserEntity.fromObject(user as unknown as Record<string, unknown>);
  }

  async findById(id: string): Promise<UserEntity | null> {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return null;
    return UserEntity.fromObject(user as unknown as Record<string, unknown>);
  }
}
