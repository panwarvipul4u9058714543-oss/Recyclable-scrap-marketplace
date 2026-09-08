import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { roleSelectionSchema } from "@/lib/roles";
import { getUserWithRoles, setUserRoles } from "@/lib/auth/users";

const bodySchema = z.object({ roles: roleSelectionSchema });

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_roles", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  await setUserRoles(user.id, parsed.data.roles);
  const updated = await getUserWithRoles(user.id);
  return NextResponse.json({ user: updated });
}
