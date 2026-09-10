import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { bulkResponseErrorPayload } from "@/lib/bulk/response-http";
import {
  listResponsesForRequirement,
  respondToBulkRequirement,
} from "@/lib/bulk/responses";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  try {
    const responses = await listResponsesForRequirement(user.id, params.id);
    return NextResponse.json({ responses });
  } catch (err) {
    const { status, body } = bulkResponseErrorPayload(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => null);
    const response = await respondToBulkRequirement(
      user.id,
      params.id,
      body,
    );
    return NextResponse.json({ response }, { status: 201 });
  } catch (err) {
    const { status, body } = bulkResponseErrorPayload(err);
    return NextResponse.json(body, { status });
  }
}
