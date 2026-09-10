import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { bulkResponseErrorPayload } from "@/lib/bulk/response-http";
import { markBulkFailed } from "@/lib/bulk/responses";

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  try {
    const body = (await request.json().catch(() => null)) as
      | {
          actualQuantity?: number;
          finalPrice?: number;
          failureReason?: string;
        }
      | null;
    const response = await markBulkFailed(user.id, params.id, body ?? {});
    return NextResponse.json({ response });
  } catch (err) {
    const { status, body } = bulkResponseErrorPayload(err);
    return NextResponse.json(body, { status });
  }
}
