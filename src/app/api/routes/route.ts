import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { routeErrorPayload } from "@/lib/routes/http";
import {
  getActiveRouteForCollector,
  startRoute,
} from "@/lib/routes/routes";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const route = await getActiveRouteForCollector(user.id);
  return NextResponse.json({ route });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => null);
    const route = await startRoute(user.id, body);
    return NextResponse.json({ route }, { status: 201 });
  } catch (err) {
    const { status, body } = routeErrorPayload(err);
    return NextResponse.json(body, { status });
  }
}
