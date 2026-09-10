import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { cancelConnection } from "@/lib/connections/connections";
import { connectionErrorPayload } from "@/lib/connections/http";

type RouteContext = { params: { id: string } };

export async function POST(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  try {
    const connection = await cancelConnection(user.id, params.id);
    return NextResponse.json({ connection });
  } catch (err) {
    const { status, body } = connectionErrorPayload(err);
    return NextResponse.json(body, { status });
  }
}
