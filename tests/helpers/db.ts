import { db } from "@/lib/db";

/**
 * Delete all rows in dependency order so each test starts from a clean slate.
 * Cheaper and safer than re-pushing the schema between tests.
 */
export async function resetDb() {
  await db.message.deleteMany();
  await db.rating.deleteMany();
  await db.connection.deleteMany();
  await db.interest.deleteMany();
  await db.listing.deleteMany();
  await db.report.deleteMany();
  await db.block.deleteMany();
  await db.routeNotification.deleteMany();
  await db.route.deleteMany();
  await db.savedSearchAlert.deleteMany();
  await db.savedSearch.deleteMany();
  await db.bulkResponseMessage.deleteMany();
  await db.bulkResponse.deleteMany();
  await db.bulkRequirement.deleteMany();
  await db.session.deleteMany();
  await db.userRole.deleteMany();
  await db.profile.deleteMany();
  await db.phoneVerification.deleteMany();
  await db.user.deleteMany();
}
