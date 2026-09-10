import { cookies } from "next/headers";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import type { UserWithRoles } from "@/lib/auth/users";

/**
 * Resolve the signed-in user for the current request from the session cookie,
 * or null if there is no valid session.
 */
export async function getCurrentUser(): Promise<UserWithRoles | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return getSessionUser(token);
}
