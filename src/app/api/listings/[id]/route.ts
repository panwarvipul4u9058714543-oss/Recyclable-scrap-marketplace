import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  closeListing,
  getListingForSeller,
  pauseListing,
  resumeListing,
  updateListing,
} from "@/lib/listings/listings";
import { listingErrorPayload } from "@/lib/listings/http";

type RouteContext = { params: { id: string } };

const actionSchema = z.object({
  action: z.enum(["pause", "resume", "close"]),
});

const ACTIONS = {
  pause: pauseListing,
  resume: resumeListing,
  close: closeListing,
} as const;

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  try {
    const listing = await getListingForSeller(user.id, params.id);
    return NextResponse.json({ listing });
  } catch (err) {
    const { status, body } = listingErrorPayload(err);
    return NextResponse.json(body, { status });
  }
}

// PATCH handles both a status transition ({ action }) and a full field edit.
export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  try {
    const asAction = actionSchema.safeParse(json);
    const listing = asAction.success
      ? await ACTIONS[asAction.data.action](user.id, params.id)
      : await updateListing(user.id, params.id, json);
    return NextResponse.json({ listing });
  } catch (err) {
    const { status, body } = listingErrorPayload(err);
    return NextResponse.json(body, { status });
  }
}
