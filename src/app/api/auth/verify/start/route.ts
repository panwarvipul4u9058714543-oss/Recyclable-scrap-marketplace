import { NextResponse } from "next/server";
import { z } from "zod";
import { phoneSchema } from "@/lib/phone";
import { startPhoneVerification } from "@/lib/auth/phone-verification";

const bodySchema = z.object({ phone: phoneSchema });

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_phone", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { phone, expiresAt, devCode } = await startPhoneVerification(
    parsed.data.phone,
  );

  // devCode is only present outside production, so the mocked flow is usable
  // without a real SMS provider.
  return NextResponse.json({ phone, expiresAt, devCode });
}
