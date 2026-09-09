import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { RatingError, submitRating } from "@/lib/ratings/ratings";

const STATUS: Record<string, number> = {
  not_found: 404,
  forbidden: 403,
  not_terminal: 409,
  already_rated: 409,
};

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const json = await request.json().catch(() => null);
  try {
    const rating = await submitRating(user.id, params.id, json);
    return NextResponse.json({ rating }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "invalid_rating", details: err.flatten() },
        { status: 400 },
      );
    }
    if (err instanceof RatingError) {
      return NextResponse.json(
        { error: err.code },
        { status: STATUS[err.code] ?? 400 },
      );
    }
    throw err;
  }
}
