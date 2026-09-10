import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createAdPlacement, listAllAdPlacements } from "@/lib/monetisation/ads";
import { MonetisationError } from "@/lib/monetisation/errors";

function errorResponse(err: unknown): NextResponse {
  if (err instanceof MonetisationError) {
    const status =
      err.code === "forbidden"
        ? 403
        : err.code === "not_found"
          ? 404
          : err.code === "disabled"
            ? 409
            : 400;
    return NextResponse.json({ error: err.code }, { status });
  }
  throw err;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (!user.isAdmin) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const placements = await listAllAdPlacements();
  return NextResponse.json({ placements });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  try {
    const placement = await createAdPlacement(user.id, body);
    return NextResponse.json({ placement }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
