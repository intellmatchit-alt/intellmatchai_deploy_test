import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      fullName: true,
      emailVerified: true,
      isActive: true,
      passwordHash: true,
      _count: { select: { contacts: true } }
    },
    take: 15
  });

  console.log('='.repeat(80));
  console.log('USERS IN DATABASE:');
  console.log('='.repeat(80));

  if (users.length === 0) {
    console.log('NO USERS FOUND IN DATABASE!');
  } else {
    users.forEach(u => {
      console.log(`
Email: ${u.email}
Name: ${u.fullName}
Email Verified: ${u.emailVerified}
Is Active: ${u.isActive}
Has Password Hash: ${u.passwordHash ? 'YES (' + u.passwordHash.substring(0, 20) + '...)' : 'NO'}
Contacts: ${u._count.contacts}
---`);
    });
  }

  console.log('\nTotal users:', users.length);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
