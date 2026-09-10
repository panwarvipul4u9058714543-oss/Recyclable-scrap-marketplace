import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { bulkResponseErrorPayload } from "@/lib/bulk/response-http";
import { revealBulkContact } from "@/lib/bulk/responses";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  try {
    const response = await revealBulkContact(user.id, params.id);
    return NextResponse.json({ response });
  } catch (err) {
    const { status, body } = bulkResponseErrorPayload(err);
    return NextResponse.json(body, { status });
  }
}
