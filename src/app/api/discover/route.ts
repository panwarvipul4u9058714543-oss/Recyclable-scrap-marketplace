import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { discoverNearby } from "@/lib/discovery/discovery";
import { COLLECTOR_ROLES } from "@/lib/roles";

/**
 * Parse the discovery filters from the URL query string. Numbers and enums
 * arrive as strings and need coercing before zod validation.
 */
function parseFilters(url: URL): Record<string, unknown> {
  const q = url.searchParams;
  const num = (key: string) => {
    const v = q.get(key);
    return v === null || v === "" ? undefined : Number(v);
  };
  const str = (key: string) => q.get(key) ?? undefined;

  return {
    near: { latitude: num("lat"), longitude: num("lng") },
    materialCategory: str("material"),
    availability: str("availability"),
    minQuantity: num("minQuantity"),
    quantityUnit: str("quantityUnit"),
    maxDistanceKm: num("maxDistanceKm"),
  };
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (!user.roles.some((r) => COLLECTOR_ROLES.includes(r))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const results = await discoverNearby(
      user.id,
      parseFilters(new URL(request.url)),
    );
    return NextResponse.json({ results });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "invalid_filters", details: err.flatten() },
        { status: 400 },
      );
    }
    throw err;
  }
}
