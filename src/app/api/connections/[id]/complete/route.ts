import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { markCompleted } from "@/lib/connections/connections";
import { connectionErrorPayload } from "@/lib/connections/http";

type RouteContext = { params: { id: string } };

const bodySchema = z.object({
  actualQuantity: z.number().positive().optional(),
  finalPrice: z.number().positive().optional(),
});

export async function POST(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  try {
    const outcome = bodySchema.parse(await request.json().catch(() => ({})));
    const connection = await markCompleted(user.id, params.id, outcome);
    return NextResponse.json({ connection });
  } catch (err) {
    const { status, body } = connectionErrorPayload(err);
    return NextResponse.json(body, { status });
  }
}
