import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  expressInterest,
  listListingInterests,
  withdrawInterest,
} from "@/lib/connections/connections";
import { connectionErrorPayload } from "@/lib/connections/http";

type RouteContext = { params: { id: string } };

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  try {
    const interests = await listListingInterests(user.id, params.id);
    return NextResponse.json({ interests });
  } catch (err) {
    const { status, body } = connectionErrorPayload(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  try {
    const interest = await expressInterest(user.id, params.id);
    return NextResponse.json({ interest }, { status: 201 });
  } catch (err) {
    const { status, body } = connectionErrorPayload(err);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  await withdrawInterest(user.id, params.id);
  return NextResponse.json({ ok: true });
}
