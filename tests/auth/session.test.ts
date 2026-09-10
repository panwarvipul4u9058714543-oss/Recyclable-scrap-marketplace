import { beforeEach, describe, expect, it } from "vitest";
import { createSession, getSessionUser, deleteSession } from "@/lib/auth/session";
import { getOrCreateUserByPhone, setUserRoles } from "@/lib/auth/users";
import { resetDb } from "../helpers/db";

beforeEach(async () => {
  await resetDb();
});

describe("sessions", () => {
  it("issues a token that resolves back to the user with roles", async () => {
    const { user } = await getOrCreateUserByPhone("+14155550100");
    await setUserRoles(user.id, ["HOUSEHOLD"]);

    const { token } = await createSession(user.id);
    const resolved = await getSessionUser(token);

    expect(resolved?.id).toBe(user.id);
    expect(resolved?.roles).toEqual(["HOUSEHOLD"]);
  });

  it("returns null for an unknown token", async () => {
    expect(await getSessionUser("does-not-exist")).toBeNull();
  });

  it("returns null for an expired session", async () => {
    const { user } = await getOrCreateUserByPhone("+14155550100");
    const past = new Date("2000-01-01T00:00:00Z");
    const { token } = await createSession(user.id, {
      now: () => past,
      ttlMs: 1000,
    });

    expect(await getSessionUser(token)).toBeNull();
  });

  it("deletes a session", async () => {
    const { user } = await getOrCreateUserByPhone("+14155550100");
    const { token } = await createSession(user.id);

    await deleteSession(token);

    expect(await getSessionUser(token)).toBeNull();
  });
});
