const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    console.log('ok');
  } catch (e) {
    console.error('err:', e?.message || e);
  } finally {
    await prisma.$disconnect();
  }
}

main();