import { NextResponse } from "next/server";

/**
 * Lightweight liveness probe. Kept dependency-free so it works even before the
 * database is provisioned.
 */
export function GET() {
  return NextResponse.json({ status: "ok" });
}
