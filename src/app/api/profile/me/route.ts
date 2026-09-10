import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  ProfileError,
  getProfileForUser,
  updateProfileForUser,
} from "@/lib/profiles/profiles";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const profile = await getProfileForUser(user.id);
  return NextResponse.json({ profile });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  try {
    const profile = await updateProfileForUser(user.id, json);
    return NextResponse.json({ profile });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "invalid_profile", details: err.flatten() },
        { status: 400 },
      );
    }
    if (err instanceof ProfileError) {
      return NextResponse.json({ error: err.code }, { status: 403 });
    }
    throw err;
  }
}
