import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  getKpiChannelBreakdown,
  getKpiSummary,
  getRepeatUsage,
  getSupplyDemandDensity,
} from "@/lib/analytics/kpis";

/**
 * Operator KPI surface. Admin-gated; a non-admin gets a 404 so the surface
 * itself is not advertised.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (!user.isAdmin) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const [summary, channels, density, repeat] = await Promise.all([
    getKpiSummary(),
    getKpiChannelBreakdown(),
    getSupplyDemandDensity(),
    getRepeatUsage(),
  ]);
  return NextResponse.json({ summary, channels, density, repeat });
}
