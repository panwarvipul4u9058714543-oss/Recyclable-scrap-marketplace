import { beforeEach, describe, expect, it } from "vitest";
import { getOrCreateUserByPhone, setUserRoles } from "@/lib/auth/users";
import {
  BlockError,
  blockUser,
  isBlockedEitherWay,
  listBlockedByIds,
  listBlockedIds,
  unblockUser,
} from "@/lib/blocks/blocks";
import { resetDb } from "../helpers/db";

beforeEach(async () => {
  await resetDb();
});

async function makeUser(phone: string) {
  const { user } = await getOrCreateUserByPhone(phone);
  await setUserRoles(user.id, ["HOUSEHOLD"]);
  return user.id;
}

describe("blockUser", () => {
  it("records the block once and is idempotent on repeat", async () => {
    const a = await makeUser("+14155550300");
    const b = await makeUser("+14155550301");

    await blockUser(a, b);
    await blockUser(a, b);

    const blocked = await listBlockedIds(a);
    expect(blocked).toEqual([b]);
  });

  it("refuses to block yourself", async () => {
    const a = await makeUser("+14155550302");
    await expect(blockUser(a, a)).rejects.toBeInstanceOf(BlockError);
  });

  it("refuses to block an unknown user", async () => {
    const a = await makeUser("+14155550303");
    await expect(blockUser(a, "does-not-exist")).rejects.toBeInstanceOf(
      BlockError,
    );
  });
});

describe("unblockUser", () => {
  it("removes the block; a no-op if none was set", async () => {
    const a = await makeUser("+14155550310");
    const b = await makeUser("+14155550311");

    await blockUser(a, b);
    await unblockUser(a, b);
    await unblockUser(a, b);

    expect(await listBlockedIds(a)).toEqual([]);
  });
});

describe("isBlockedEitherWay", () => {
  it("is true when either party has blocked the other", async () => {
    const a = await makeUser("+14155550320");
    const b = await makeUser("+14155550321");

    expect(await isBlockedEitherWay(a, b)).toBe(false);
    await blockUser(a, b);
    expect(await isBlockedEitherWay(a, b)).toBe(true);
    expect(await isBlockedEitherWay(b, a)).toBe(true);

    await unblockUser(a, b);
    await blockUser(b, a);
    expect(await isBlockedEitherWay(a, b)).toBe(true);
  });
});

describe("listBlockedByIds", () => {
  it("returns the ids of users who blocked this user", async () => {
    const a = await makeUser("+14155550330");
    const b = await makeUser("+14155550331");
    const c = await makeUser("+14155550332");

    await blockUser(b, a);
    await blockUser(c, a);

    const blockedBy = await listBlockedByIds(a);
    expect(blockedBy.sort()).toEqual([b, c].sort());
  });
});
