import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { dismissReport, resolveReport } from "@/lib/moderation/moderation";
import { moderationErrorPayload } from "@/lib/moderation/http";

const bodySchema = z.object({
  decision: z.enum(["RESOLVED", "DISMISSED"]),
  note: z.string().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  try {
    const report =
      parsed.data.decision === "RESOLVED"
        ? await resolveReport(user.id, params.id, { note: parsed.data.note })
        : await dismissReport(user.id, params.id, { note: parsed.data.note });
    return NextResponse.json({ report });
  } catch (err) {
    const { status, body } = moderationErrorPayload(err);
    return NextResponse.json(body, { status });
  }
}
