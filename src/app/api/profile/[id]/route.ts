import { NextResponse } from "next/server";
import { getPublicProfile } from "@/lib/profiles/profiles";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const profile = await getPublicProfile(params.id);
  if (!profile) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ profile });
}
