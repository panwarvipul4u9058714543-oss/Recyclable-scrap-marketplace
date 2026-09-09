import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listOpenReportsForAdmin } from "@/lib/moderation/moderation";
import { moderationErrorPayload } from "@/lib/moderation/http";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  try {
    const reports = await listOpenReportsForAdmin(user.id);
    return NextResponse.json({ reports });
  } catch (err) {
    const { status, body } = moderationErrorPayload(err);
    return NextResponse.json(body, { status });
  }
}
