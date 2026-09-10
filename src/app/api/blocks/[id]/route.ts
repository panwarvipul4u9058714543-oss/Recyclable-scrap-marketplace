import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { unblockUser } from "@/lib/blocks/blocks";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  await unblockUser(user.id, params.id);
  return NextResponse.json({ ok: true });
}
