import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { reinstateUser, suspendUser } from "@/lib/moderation/moderation";
import { moderationErrorPayload } from "@/lib/moderation/http";

const bodySchema = z.object({ reason: z.string() });

export async function POST(
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
    const summary = await suspendUser(user.id, params.id, {
      reason: parsed.data.reason,
    });
    return NextResponse.json({ user: summary });
  } catch (err) {
    const { status, body } = moderationErrorPayload(err);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  try {
    const summary = await reinstateUser(user.id, params.id);
    return NextResponse.json({ user: summary });
  } catch (err) {
    const { status, body } = moderationErrorPayload(err);
    return NextResponse.json(body, { status });
  }
}
