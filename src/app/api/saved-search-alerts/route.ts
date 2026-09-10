import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listSavedSearchAlertsForBuyer } from "@/lib/bulk/saved-searches";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const alerts = await listSavedSearchAlertsForBuyer(user.id);
  return NextResponse.json({ alerts });
}
