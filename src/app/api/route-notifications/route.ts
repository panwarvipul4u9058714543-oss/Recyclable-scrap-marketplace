import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listNotificationsForCollector } from "@/lib/routes/notifications";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const notifications = await listNotificationsForCollector(user.id);
  return NextResponse.json({ notifications });
}
