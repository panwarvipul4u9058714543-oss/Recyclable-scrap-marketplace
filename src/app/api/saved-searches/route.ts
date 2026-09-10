import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { savedSearchErrorPayload } from "@/lib/bulk/saved-search-http";
import {
  createSavedSearch,
  listSavedSearchesForBuyer,
} from "@/lib/bulk/saved-searches";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const searches = await listSavedSearchesForBuyer(user.id);
  return NextResponse.json({ searches });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => null);
    const search = await createSavedSearch(user.id, body);
    return NextResponse.json({ search }, { status: 201 });
  } catch (err) {
    const { status, body } = savedSearchErrorPayload(err);
    return NextResponse.json(body, { status });
  }
}
