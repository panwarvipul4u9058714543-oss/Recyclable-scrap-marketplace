import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { setNotifyOnRouteMatch } from "@/lib/routes/notifications";

const bodySchema = z.object({
  notifyOnRouteMatch: z.boolean(),
});

/**
 * Update the caller's notification preferences. Currently only carries the
 * route-match toggle; extend with more preferences here as they are added.
 */
export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  await setNotifyOnRouteMatch(user.id, parsed.data.notifyOnRouteMatch);
  return NextResponse.json({
    preferences: { notifyOnRouteMatch: parsed.data.notifyOnRouteMatch },
  });
}
