import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { savedSearchErrorPayload } from "@/lib/bulk/saved-search-http";
import {
  deleteSavedSearch,
  updateSavedSearch,
} from "@/lib/bulk/saved-searches";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => null);
    const search = await updateSavedSearch(user.id, params.id, body);
    return NextResponse.json({ search });
  } catch (err) {
    const { status, body } = savedSearchErrorPayload(err);
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
    await deleteSavedSearch(user.id, params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = savedSearchErrorPayload(err);
    return NextResponse.json(body, { status });
  }
}
