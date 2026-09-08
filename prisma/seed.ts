import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // A sample verified household+business account for local development.
  const phone = "+919876543210";
  const user = await prisma.user.upsert({
    where: { phone },
    update: {},
    create: { phone, phoneVerifiedAt: new Date() },
  });

  for (const role of ["HOUSEHOLD", "BUSINESS"] as const) {
    await prisma.userRole.upsert({
      where: { userId_role: { userId: user.id, role } },
      update: {},
      create: { userId: user.id, role },
    });
  }

  console.log(`Seeded user ${phone} with roles HOUSEHOLD, BUSINESS.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
