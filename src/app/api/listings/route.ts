import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createListing, listSellerListings } from "@/lib/listings/listings";
import { listingErrorPayload } from "@/lib/listings/http";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const listings = await listSellerListings(user.id);
  return NextResponse.json({ listings });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  try {
    const listing = await createListing(user.id, json);
    return NextResponse.json({ listing }, { status: 201 });
  } catch (err) {
    const { status, body } = listingErrorPayload(err);
    return NextResponse.json(body, { status });
  }
}
