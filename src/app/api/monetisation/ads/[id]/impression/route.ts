import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { recordAdImpression } from "@/lib/monetisation/ads";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  await recordAdImpression(params.id, user?.id ?? null);
  return NextResponse.json({ ok: true });
}
