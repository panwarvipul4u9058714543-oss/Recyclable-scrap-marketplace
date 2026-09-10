import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  listCollectorConnections,
  listSellerConnections,
} from "@/lib/connections/connections";

/**
 * The current user's connections, split by their side. Either party may see
 * their own view; the same connection appears under "asSeller" for the
 * lister and "asCollector" for the selected buyer.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const [asSeller, asCollector] = await Promise.all([
    listSellerConnections(user.id),
    listCollectorConnections(user.id),
  ]);
  return NextResponse.json({ asSeller, asCollector });
}
