import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  deleteSession,
  sessionCookieOptions,
} from "@/lib/auth/session";

export async function POST() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(token);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", sessionCookieOptions({ maxAge: 0 }));
  return response;
}
