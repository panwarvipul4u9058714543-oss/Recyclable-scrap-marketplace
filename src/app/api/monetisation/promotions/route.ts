import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { MonetisationError } from "@/lib/monetisation/errors";
import {
  listPromotionsForUser,
  purchasePromotion,
} from "@/lib/monetisation/promotions";

function errorResponse(err: unknown): NextResponse {
  if (err instanceof MonetisationError) {
    const status =
      err.code === "forbidden"
        ? 403
        : err.code === "not_found"
          ? 404
          : err.code === "disabled" || err.code === "not_professional"
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
  const promotions = await listPromotionsForUser(user.id);
  return NextResponse.json({ promotions });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  try {
    const promotion = await purchasePromotion(user.id, body);
    return NextResponse.json({ promotion }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
