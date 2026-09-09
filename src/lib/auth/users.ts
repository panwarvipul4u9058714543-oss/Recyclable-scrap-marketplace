import type { User } from "@prisma/client";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { type Role, roleSelectionSchema } from "@/lib/roles";

export interface UserWithRoles {
  id: string;
  phone: string;
  phoneVerifiedAt: Date | null;
  roles: Role[];
  isAdmin: boolean;
  suspendedAt: Date | null;
  suspensionReason: string | null;
  notifyOnRouteMatch: boolean;
}

/**
 * Look up a user by phone, creating the account on first sight. The phone is
 * normalized so the same number is never duplicated across formats.
 */
export async function getOrCreateUserByPhone(
  rawPhone: string,
): Promise<{ user: User; created: boolean }> {
  const phone = normalizePhone(rawPhone);
  const existing = await db.user.findUnique({ where: { phone } });
  if (existing) return { user: existing, created: false };

  const user = await db.user.create({ data: { phone } });
  return { user, created: true };
}

/**
 * Replace a user's roles with the given selection. Supports holding multiple
 * roles at once; the selection is validated and de-duplicated first.
 */
export async function setUserRoles(
  userId: string,
  roles: Role[],
): Promise<Role[]> {
  const selection = roleSelectionSchema.parse(roles);

  await db.$transaction([
    db.userRole.deleteMany({ where: { userId } }),
    db.userRole.createMany({
      data: selection.map((role) => ({ userId, role })),
    }),
  ]);

  return selection;
}

export async function getUserWithRoles(
  userId: string,
): Promise<UserWithRoles | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { roles: true },
  });
  if (!user) return null;

  return {
    id: user.id,
    phone: user.phone,
    phoneVerifiedAt: user.phoneVerifiedAt,
    roles: user.roles.map((r) => r.role as Role),
    isAdmin: user.isAdmin,
    suspendedAt: user.suspendedAt,
    suspensionReason: user.suspensionReason,
    notifyOnRouteMatch: user.notifyOnRouteMatch,
  };
}
