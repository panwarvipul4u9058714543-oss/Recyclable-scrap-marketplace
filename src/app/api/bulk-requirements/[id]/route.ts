import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { bulkRequirementErrorPayload } from "@/lib/bulk/http";
import {
  closeBulkRequirement,
  getBulkRequirement,
  updateBulkRequirement,
} from "@/lib/bulk/requirements";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const requirement = await getBulkRequirement(params.id);
  if (!requirement) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ requirement });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => null);
    const requirement = await updateBulkRequirement(user.id, params.id, body);
    return NextResponse.json({ requirement });
  } catch (err) {
    const { status, body } = bulkRequirementErrorPayload(err);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  try {
    const requirement = await closeBulkRequirement(user.id, params.id);
    return NextResponse.json({ requirement });
  } catch (err) {
    const { status, body } = bulkRequirementErrorPayload(err);
    return NextResponse.json(body, { status });
  }
}
