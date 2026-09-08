import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { getUserWithRoles, type UserWithRoles } from "@/lib/auth/users";

/** Name of the cookie that carries the opaque session token. */
export const SESSION_COOKIE = "rsm_session";

/**
 * Shared attributes for the session cookie, so the cookie set at login and the
 * one cleared at logout always match. Pass `expires` (login) or `maxAge: 0`
 * (logout) via overrides.
 */
export function sessionCookieOptions(
  overrides: { expires?: Date; maxAge?: number } = {},
) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...overrides,
  };
}

/** Default session lifetime: 30 days. */
const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface SessionDeps {
  now?: () => Date;
  ttlMs?: number;
  generateToken?: () => string;
}

export async function createSession(
  userId: string,
  deps: SessionDeps = {},
): Promise<{ token: string; expiresAt: Date }> {
  const now = deps.now?.() ?? new Date();
  const ttlMs = deps.ttlMs ?? DEFAULT_TTL_MS;
  const token = deps.generateToken?.() ?? randomBytes(32).toString("hex");
  const expiresAt = new Date(now.getTime() + ttlMs);

  await db.session.create({ data: { token, userId, expiresAt } });
  return { token, expiresAt };
}

/**
 * Resolve a session token to its user (with roles), or null when the token is
 * unknown or the session has expired. Expired sessions are cleaned up lazily.
 */
export async function getSessionUser(
  token: string,
  deps: Pick<SessionDeps, "now"> = {},
): Promise<UserWithRoles | null> {
  const now = deps.now?.() ?? new Date();
  const session = await db.session.findUnique({ where: { token } });
  if (!session) return null;

  if (session.expiresAt <= now) {
    await db.session.delete({ where: { token } }).catch(() => {});
    return null;
  }

  return getUserWithRoles(session.userId);
}

export async function deleteSession(token: string): Promise<void> {
  await db.session.deleteMany({ where: { token } });
}
