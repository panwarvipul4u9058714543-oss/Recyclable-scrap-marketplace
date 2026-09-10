import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { bulkResponseErrorPayload } from "@/lib/bulk/response-http";
import {
  cancelBulkResponse,
  getBulkResponseDetail,
  withdrawBulkResponse,
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
    const response = await getBulkResponseDetail(user.id, params.id);
    return NextResponse.json({ response });
  } catch (err) {
    const { status, body } = bulkResponseErrorPayload(err);
    return NextResponse.json(body, { status });
  }
}

/**
 * DELETE cancels a SELECTED response (either party) or withdraws a PENDING
 * one (supplier only). The service refuses inconsistent transitions.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  try {
    // Try the supplier-only withdraw path first; fall back to cancel for a
    // SELECTED response.
    const detail = await getBulkResponseDetail(user.id, params.id);
    if (detail.status === "PENDING" && detail.supplierId === user.id) {
      const response = await withdrawBulkResponse(user.id, params.id);
      return NextResponse.json({ response });
    }
    const response = await cancelBulkResponse(user.id, params.id);
    return NextResponse.json({ response });
  } catch (err) {
    const { status, body } = bulkResponseErrorPayload(err);
    return NextResponse.json(body, { status });
  }
}
