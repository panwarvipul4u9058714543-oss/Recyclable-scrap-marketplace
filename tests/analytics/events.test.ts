import { beforeEach, describe, expect, it } from "vitest";
import {
  countEvents,
  listEvents,
  recordEvent,
} from "@/lib/analytics/events";
import { db } from "@/lib/db";
import { resetDb } from "../helpers/db";

beforeEach(async () => {
  await resetDb();
});

describe("recordEvent", () => {
  it("inserts a row with defaults for optional fields", async () => {
    const ev = await recordEvent({ type: "USER_REGISTERED" });
    expect(ev).not.toBeNull();
    expect(ev!.type).toBe("USER_REGISTERED");
    expect(ev!.channel).toBe("GENERAL");
    expect(ev!.actorId).toBeNull();
    expect(ev!.material).toBeNull();
    expect(ev!.metadata).toBeNull();

    const row = await db.analyticsEvent.findUnique({ where: { id: ev!.id } });
    expect(row).not.toBeNull();
  });

  it("persists the full input including material, locality, actorRole and metadata JSON", async () => {
    const ev = await recordEvent({
      type: "LISTING_CREATED",
      channel: "HOUSEHOLD",
      actorId: "u1",
      actorRole: "HOUSEHOLD",
      subjectType: "LISTING",
      subjectId: "l1",
      material: "PLASTIC",
      locality: "Koramangala",
      metadata: { quantityMin: 5, quantityMax: 10 },
    });
    expect(ev).not.toBeNull();
    expect(ev!.channel).toBe("HOUSEHOLD");
    expect(ev!.actorId).toBe("u1");
    expect(ev!.actorRole).toBe("HOUSEHOLD");
    expect(ev!.subjectType).toBe("LISTING");
    expect(ev!.subjectId).toBe("l1");
    expect(ev!.material).toBe("PLASTIC");
    expect(ev!.locality).toBe("Koramangala");
    expect(ev!.metadata).toEqual({ quantityMin: 5, quantityMax: 10 });
  });

  it("stores an empty metadata object as null so queries don't have to strip {}", async () => {
    const ev = await recordEvent({ type: "USER_REGISTERED", metadata: {} });
    expect(ev!.metadata).toBeNull();
  });

  it("never throws when the write fails — returns null instead", async () => {
    // A type longer than any conceivable enum but still a string; the DB accepts
    // it, so use a deliberately invalid input to exercise the try/catch. We
    // simulate a failure by force-writing a duplicate id via the underlying
    // client — recordEvent should swallow the resulting error.
    const first = await recordEvent({ type: "USER_REGISTERED" });
    expect(first).not.toBeNull();
    // Passing an explicit createdAt is fine; the guarantee is that a raw client
    // exception during create is caught. Force it by writing to a broken table
    // via a raw statement:
    const survived = await recordEventWithForcedFailure();
    expect(survived).toBeNull();
  });
});

async function recordEventWithForcedFailure() {
  // Use a monkey-patched proxy to make one create call throw, then verify
  // recordEvent returns null instead of propagating.
  const real = db.analyticsEvent.create;
  db.analyticsEvent.create = () => {
    throw new Error("simulated");
  };
  try {
    return await recordEvent({ type: "USER_REGISTERED" });
  } finally {
    db.analyticsEvent.create = real;
  }
}

describe("countEvents and listEvents", () => {
  it("filter by type, channel, subject and time window", async () => {
    const past = new Date("2020-01-01T00:00:00Z");
    const now = new Date();
    await recordEvent({ type: "LISTING_CREATED", channel: "HOUSEHOLD" });
    await recordEvent({ type: "LISTING_CREATED", channel: "HOUSEHOLD" });
    await recordEvent({
      type: "BULK_REQUIREMENT_CREATED",
      channel: "BULK",
      material: "METAL",
    });
    await recordEvent({
      type: "LISTING_CREATED",
      channel: "HOUSEHOLD",
      createdAt: past,
    });

    expect(await countEvents({ type: "LISTING_CREATED" })).toBe(3);
    expect(await countEvents({ channel: "BULK" })).toBe(1);
    expect(await countEvents({ material: "METAL" })).toBe(1);
    expect(await countEvents({ since: new Date(now.getTime() - 60_000) })).toBe(
      3,
    );

    const bulk = await listEvents({ channel: "BULK" });
    expect(bulk).toHaveLength(1);
    expect(bulk[0].type).toBe("BULK_REQUIREMENT_CREATED");
    expect(bulk[0].material).toBe("METAL");
  });

  it("accepts arrays for type and channel", async () => {
    await recordEvent({ type: "LISTING_CREATED", channel: "HOUSEHOLD" });
    await recordEvent({
      type: "BULK_REQUIREMENT_CREATED",
      channel: "BULK",
    });
    await recordEvent({ type: "ROUTE_STARTED", channel: "ROUTE" });

    expect(
      await countEvents({
        type: ["LISTING_CREATED", "BULK_REQUIREMENT_CREATED"],
      }),
    ).toBe(2);
    expect(await countEvents({ channel: ["BULK", "ROUTE"] })).toBe(2);
  });
});
