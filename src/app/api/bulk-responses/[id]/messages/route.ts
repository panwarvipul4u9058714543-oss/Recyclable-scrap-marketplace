import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { bulkResponseErrorPayload } from "@/lib/bulk/response-http";
import { listBulkMessages, postBulkMessage } from "@/lib/bulk/responses";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  try {
    const messages = await listBulkMessages(user.id, params.id);
    return NextResponse.json({ messages });
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
    const body = (await request.json().catch(() => null)) as {
      body?: string;
    } | null;
    const message = await postBulkMessage(
      user.id,
      params.id,
      body?.body ?? "",
    );
    return NextResponse.json({ message }, { status: 201 });
  } catch (err) {
    const { status, body } = bulkResponseErrorPayload(err);
    return NextResponse.json(body, { status });
  }
}
