import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { markFailed } from "@/lib/connections/connections";
import { connectionErrorPayload } from "@/lib/connections/http";

type RouteContext = { params: { id: string } };

const bodySchema = z.object({
  actualQuantity: z.number().positive().optional(),
  finalPrice: z.number().positive().optional(),
  failureReason: z.string().max(500).optional(),
});

export async function POST(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  try {
    const outcome = bodySchema.parse(await request.json().catch(() => ({})));
    const connection = await markFailed(user.id, params.id, outcome);
    return NextResponse.json({ connection });
  } catch (err) {
    const { status, body } = connectionErrorPayload(err);
    return NextResponse.json(body, { status });
  }
}
