import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { routeErrorPayload } from "@/lib/routes/http";
import { endRoute } from "@/lib/routes/routes";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  try {
    const route = await endRoute(user.id, params.id);
    return NextResponse.json({ route });
  } catch (err) {
    const { status, body } = routeErrorPayload(err);
    return NextResponse.json(body, { status });
  }
}
