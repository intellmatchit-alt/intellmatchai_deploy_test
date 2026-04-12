import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@intellmatch.com';
  const password = 'SuperAdmin@2024';

  const existing = await prisma.superAdmin.findUnique({ where: { email } });
  if (existing) {
    console.log('Super admin already exists:', email);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.superAdmin.create({
    data: {
      email,
      passwordHash,
      fullName: 'Super Admin',
      role: 'SUPER_ADMIN',
    },
  });

  console.log('Created super admin:', admin.email, 'with role:', admin.role);
  console.log('Password:', password);
  console.log('CHANGE THIS PASSWORD IMMEDIATELY!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
