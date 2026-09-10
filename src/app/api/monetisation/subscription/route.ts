import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { MonetisationError } from "@/lib/monetisation/errors";
import {
  cancelSubscription,
  getActiveSubscription,
  subscribe,
} from "@/lib/monetisation/subscriptions";

function errorResponse(err: unknown): NextResponse {
  if (err instanceof MonetisationError) {
    const status =
      err.code === "forbidden"
        ? 403
        : err.code === "not_found"
          ? 404
          : err.code === "disabled" ||
              err.code === "already_active" ||
              err.code === "not_professional"
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
  const active = await getActiveSubscription(user.id);
  return NextResponse.json({ subscription: active });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  try {
    const subscription = await subscribe(user.id, body);
    return NextResponse.json({ subscription }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const active = await getActiveSubscription(user.id);
  if (!active) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  try {
    const subscription = await cancelSubscription(user.id, active.id);
    return NextResponse.json({ subscription });
  } catch (err) {
    return errorResponse(err);
  }
}
