import { NextResponse } from "next/server";
import { z } from "zod";
import { phoneSchema } from "@/lib/phone";
import { checkPhoneVerification } from "@/lib/auth/phone-verification";
import {
  createSession,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { getUserWithRoles } from "@/lib/auth/users";

const bodySchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

const FAILURE_STATUS: Record<string, number> = {
  no_pending: 400,
  expired: 410,
  too_many_attempts: 429,
  invalid_code: 401,
};

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await checkPhoneVerification(
    parsed.data.phone,
    parsed.data.code,
  );

  if (!result.ok) {
    return NextResponse.json(
      { error: result.reason },
      { status: FAILURE_STATUS[result.reason] ?? 400 },
    );
  }

  const { token, expiresAt } = await createSession(result.userId);
  const user = await getUserWithRoles(result.userId);

  const response = NextResponse.json({ user, created: result.created });
  response.cookies.set(
    SESSION_COOKIE,
    token,
    sessionCookieOptions({ expires: expiresAt }),
  );
  return response;
}
