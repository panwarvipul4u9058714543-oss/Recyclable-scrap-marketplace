import { db } from "@/lib/db";

/**
 * Delete all rows in dependency order so each test starts from a clean slate.
 * Cheaper and safer than re-pushing the schema between tests.
 */
export async function resetDb() {
  await db.connection.deleteMany();
  await db.interest.deleteMany();
  await db.listing.deleteMany();
  await db.session.deleteMany();
  await db.userRole.deleteMany();
  await db.phoneVerification.deleteMany();
  await db.user.deleteMany();
}
