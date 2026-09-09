import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getConnectionDetail } from "@/lib/connections/connections";
import { connectionErrorPayload } from "@/lib/connections/http";

type RouteContext = { params: { id: string } };

/** Returns the connection detail for the current user (must be a party). */
export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  try {
    const connection = await getConnectionDetail(user.id, params.id);
    return NextResponse.json({ connection });
  } catch (err) {
    const { status, body } = connectionErrorPayload(err);
    return NextResponse.json(body, { status });
  }
}
