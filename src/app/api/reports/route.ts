import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  REPORT_TARGET_TYPES,
  ReportError,
  reportListing,
  reportUser,
} from "@/lib/reports/reports";

const bodySchema = z.object({
  targetType: z.enum(REPORT_TARGET_TYPES),
  targetId: z.string().min(1),
  reason: z.string(),
  details: z.string().optional(),
});

const STATUS: Record<string, number> = {
  not_found: 404,
  own_target: 422,
  invalid_status: 409,
};

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  try {
    const parsed = bodySchema.parse(json);
    const report =
      parsed.targetType === "LISTING"
        ? await reportListing(user.id, parsed.targetId, {
            reason: parsed.reason,
            details: parsed.details,
          })
        : await reportUser(user.id, parsed.targetId, {
            reason: parsed.reason,
            details: parsed.details,
          });
    return NextResponse.json({ report }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "invalid_report", details: err.flatten() },
        { status: 400 },
      );
    }
    if (err instanceof ReportError) {
      return NextResponse.json(
        { error: err.code },
        { status: STATUS[err.code] ?? 400 },
      );
    }
    throw err;
  }
}
