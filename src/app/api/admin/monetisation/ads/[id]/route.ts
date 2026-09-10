import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { setAdPlacementStatus } from "@/lib/monetisation/ads";
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

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    status?: "ACTIVE" | "PAUSED";
  };
  if (body.status !== "ACTIVE" && body.status !== "PAUSED") {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }
  try {
    const placement = await setAdPlacementStatus(user.id, params.id, body.status);
    return NextResponse.json({ placement });
  } catch (err) {
    return errorResponse(err);
  }
}
