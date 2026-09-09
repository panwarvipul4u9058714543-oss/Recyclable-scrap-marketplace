import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  BlockError,
  blockUser,
  listBlockedIds,
} from "@/lib/blocks/blocks";

const bodySchema = z.object({ userId: z.string().min(1) });

const STATUS: Record<string, number> = {
  self_block: 422,
  not_found: 404,
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const blocked = await listBlockedIds(user.id);
  return NextResponse.json({ blocked });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  try {
    await blockUser(user.id, parsed.data.userId);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    if (err instanceof BlockError) {
      return NextResponse.json(
        { error: err.code },
        { status: STATUS[err.code] ?? 400 },
      );
    }
    throw err;
  }
}
