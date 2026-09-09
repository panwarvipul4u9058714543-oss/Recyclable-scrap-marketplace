import { db } from "@/lib/db";

export type BlockErrorCode = "self_block" | "not_found";

export class BlockError extends Error {
  constructor(public readonly code: BlockErrorCode) {
    super(code);
    this.name = "BlockError";
  }
}

/**
 * Add `blockedId` to `blockerId`'s block list. Idempotent — a repeat call
 * is a no-op. Blocks are one-way from the blocker's perspective but the
 * interaction gates (interest, buyer selection, chat) treat them
 * symmetrically: `isBlockedEitherWay` returns true from either side.
 */
export async function blockUser(
  blockerId: string,
  blockedId: string,
): Promise<void> {
  if (blockerId === blockedId) throw new BlockError("self_block");
  const target = await db.user.findUnique({ where: { id: blockedId } });
  if (!target) throw new BlockError("not_found");

  // Upsert so a repeat call is a quiet no-op instead of a caught unique-key
  // error (which Prisma still logs even when swallowed).
  await db.block.upsert({
    where: { blockerId_blockedId: { blockerId, blockedId } },
    create: { blockerId, blockedId },
    update: {},
  });
}

export async function unblockUser(
  blockerId: string,
  blockedId: string,
): Promise<void> {
  await db.block.deleteMany({ where: { blockerId, blockedId } });
}

/** The ids `userId` has blocked. */
export async function listBlockedIds(userId: string): Promise<string[]> {
  const rows = await db.block.findMany({
    where: { blockerId: userId },
    select: { blockedId: true },
  });
  return rows.map((r) => r.blockedId);
}

/** The ids of users who have blocked `userId`. */
export async function listBlockedByIds(userId: string): Promise<string[]> {
  const rows = await db.block.findMany({
    where: { blockedId: userId },
    select: { blockerId: true },
  });
  return rows.map((r) => r.blockerId);
}

/** True if either party has blocked the other. */
export async function isBlockedEitherWay(
  a: string,
  b: string,
): Promise<boolean> {
  if (a === b) return false;
  const row = await db.block.findFirst({
    where: {
      OR: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
    select: { id: true },
  });
  return row !== null;
}
