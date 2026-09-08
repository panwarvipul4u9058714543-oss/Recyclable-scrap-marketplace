import { beforeEach, describe, expect, it } from "vitest";
import {
  getOrCreateUserByPhone,
  getUserWithRoles,
  setUserRoles,
} from "@/lib/auth/users";
import { resetDb } from "../helpers/db";

beforeEach(async () => {
  await resetDb();
});

describe("getOrCreateUserByPhone", () => {
  it("creates a user once and returns the same user afterwards", async () => {
    const first = await getOrCreateUserByPhone("+14155550100");
    expect(first.created).toBe(true);

    const second = await getOrCreateUserByPhone("+14155550100");
    expect(second.created).toBe(false);
    expect(second.user.id).toBe(first.user.id);
  });
});

describe("setUserRoles", () => {
  it("supports multiple roles on one account", async () => {
    const { user } = await getOrCreateUserByPhone("+14155550100");

    const roles = await setUserRoles(user.id, ["HOUSEHOLD", "BUSINESS"]);

    expect(roles.sort()).toEqual(["BUSINESS", "HOUSEHOLD"]);
    const loaded = await getUserWithRoles(user.id);
    expect(loaded?.roles.sort()).toEqual(["BUSINESS", "HOUSEHOLD"]);
  });

  it("replaces the previous role set and de-duplicates", async () => {
    const { user } = await getOrCreateUserByPhone("+14155550100");
    await setUserRoles(user.id, ["HOUSEHOLD"]);

    const roles = await setUserRoles(user.id, ["COLLECTOR", "COLLECTOR"]);

    expect(roles).toEqual(["COLLECTOR"]);
  });

  it("rejects an empty selection", async () => {
    const { user } = await getOrCreateUserByPhone("+14155550100");
    await expect(setUserRoles(user.id, [])).rejects.toThrow();
  });

  it("rejects an unknown role", async () => {
    const { user } = await getOrCreateUserByPhone("+14155550100");
    // @ts-expect-error deliberately invalid role
    await expect(setUserRoles(user.id, ["MAYOR"])).rejects.toThrow();
  });
});
