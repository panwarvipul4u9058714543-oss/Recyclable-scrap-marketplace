import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { MonetisationError } from "@/lib/monetisation/errors";
import { cancelPromotion } from "@/lib/monetisation/promotions";

function errorResponse(err: unknown): NextResponse {
  if (err instanceof MonetisationError) {
    const status =
      err.code === "forbidden"
        ? 403
        : err.code === "not_found"
          ? 404
          : 400;
    return NextResponse.json({ error: err.code }, { status });
  }
  throw err;
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  try {
    const promotion = await cancelPromotion(user.id, params.id);
    return NextResponse.json({ promotion });
  } catch (err) {
    return errorResponse(err);
  }
}
