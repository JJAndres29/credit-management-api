import { PrismaClient, Role } from '@prisma/client';
import bcryptjs from 'bcryptjs';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { email: 'admin@credit.com' } });
  if (existing) {
    console.log('Admin user already exists, skipping seed.');
    return;
  }

  const hashedPassword = bcryptjs.hashSync('Admin1234!', 10);

  const admin = await prisma.user.create({
    data: {
      name: 'Administrador',
      email: 'admin@credit.com',
      password: hashedPassword,
      role: Role.ADMIN,
    },
  });

  console.log(`Admin user created: ${admin.email}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
