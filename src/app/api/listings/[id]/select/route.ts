import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { selectBuyer } from "@/lib/connections/connections";
import { connectionErrorPayload } from "@/lib/connections/http";

type RouteContext = { params: { id: string } };

const bodySchema = z.object({ collectorId: z.string().min(1) });

export async function POST(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  try {
    const { collectorId } = bodySchema.parse(
      await request.json().catch(() => ({})),
    );
    const connection = await selectBuyer(user.id, params.id, collectorId);
    return NextResponse.json({ connection }, { status: 201 });
  } catch (err) {
    const { status, body } = connectionErrorPayload(err);
    return NextResponse.json(body, { status });
  }
}
