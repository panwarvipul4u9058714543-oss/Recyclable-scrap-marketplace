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

  // A sample active listing so the listings screen isn't empty on first run.
  const existingListing = await prisma.listing.findFirst({
    where: { sellerId: user.id },
  });
  if (!existingListing) {
    await prisma.listing.create({
      data: {
        sellerId: user.id,
        sellerType: "HOUSEHOLD",
        materialCategory: "PLASTIC",
        title: "Clean PET bottles, ~6 kg",
        description: "About a month of household plastic bottles, rinsed.",
        photos: JSON.stringify(["https://example.com/bottles.jpg"]),
        quantityMin: 5,
        quantityMax: 8,
        quantityUnit: "KG",
        locality: "Koramangala, Bengaluru",
        latitude: 12.9352,
        longitude: 77.6245,
        availability: "WEEKENDS",
      },
    });
  }

  console.log(`Seeded user ${phone} with roles HOUSEHOLD, BUSINESS and a listing.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
