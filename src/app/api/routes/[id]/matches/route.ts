import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { routeErrorPayload } from "@/lib/routes/http";
import { findMatchingListings } from "@/lib/routes/routes";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  try {
    const matches = await findMatchingListings(user.id, params.id);
    return NextResponse.json({ matches });
  } catch (err) {
    const { status, body } = routeErrorPayload(err);
    return NextResponse.json(body, { status });
  }
}
