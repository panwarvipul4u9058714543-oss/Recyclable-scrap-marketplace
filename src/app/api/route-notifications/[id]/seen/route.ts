import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  markNotificationSeen,
  RouteNotificationError,
} from "@/lib/routes/notifications";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  try {
    const row = await markNotificationSeen(user.id, params.id);
    return NextResponse.json({ notification: row });
  } catch (err) {
    if (err instanceof RouteNotificationError) {
      const status = err.code === "not_found" ? 404 : 403;
      return NextResponse.json({ error: err.code }, { status });
    }
    throw err;
  }
}
