import { z } from "zod";
import { db } from "@/lib/db";
import {
  MATERIAL_CATEGORIES,
  type MaterialCategory,
  materialCategorySchema,
} from "@/lib/materials";
import { isUserSuspended } from "@/lib/moderation/moderation";
import { getRatingSummary, type RatingSummary } from "@/lib/ratings/ratings";
import type { Role } from "@/lib/roles";

export type ProfileErrorCode = "suspended";

export class ProfileError extends Error {
  constructor(public readonly code: ProfileErrorCode) {
    super(code);
    this.name = "ProfileError";
  }
}

/**
 * A user's own view of their profile. Every field is optional — the profile
 * row is created on the first successful update, and missing fields come back
 * as null / empty. `acceptedMaterials` is the decoded array (the row stores
 * it JSON-encoded because SQLite has no native array type).
 */
export interface ProfileDTO {
  userId: string;
  displayName: string | null;
  bio: string | null;
  organisationName: string | null;
  registrationId: string | null;
  serviceAreaLocality: string | null;
  serviceAreaRadiusKm: number | null;
  acceptedMaterials: MaterialCategory[];
  updatedAt: Date | null;
}

/** The reputation summary aggregated from the user's Connection history. */
export interface ReputationSummary {
  completedAsSeller: number;
  completedAsCollector: number;
  cancelledOrExpired: number;
  failed: number;
  memberSince: Date;
  rating: RatingSummary;
}

/**
 * The public view of a profile. Deliberately excludes the phone number and
 * any other contact information; those are only revealed through the mutual
 * contact-reveal flow on an active connection.
 */
export interface PublicProfile {
  userId: string;
  displayName: string | null;
  bio: string | null;
  organisationName: string | null;
  registrationId: string | null;
  serviceAreaLocality: string | null;
  serviceAreaRadiusKm: number | null;
  acceptedMaterials: MaterialCategory[];
  roles: Role[];
  reputation: ReputationSummary;
  isSuspended: boolean;
}

// A field can be:
//   - omitted (undefined) — leave the stored value alone
//   - explicitly cleared ("" or null) — set the column to null
//   - a validated new value — trim, then apply the length/range rules
// `nullableString` collapses "" / null to null and validates non-empty values.
function nullableString(min: number, max: number) {
  return z.preprocess((v) => {
    if (v === null) return null;
    if (typeof v !== "string") return v;
    const trimmed = v.trim();
    return trimmed === "" ? null : trimmed;
  }, z.union([z.null(), z.string().min(min).max(max)]));
}

function nullableNumber(min: number, max: number) {
  return z.preprocess(
    (v) => (v === "" ? null : v),
    z.union([z.null(), z.number().gte(min).lte(max)]),
  );
}

export const profileInputSchema = z.object({
  displayName: nullableString(2, 60).optional(),
  bio: nullableString(0, 500).optional(),
  organisationName: nullableString(2, 120).optional(),
  registrationId: nullableString(2, 40).optional(),
  serviceAreaLocality: nullableString(2, 120).optional(),
  serviceAreaRadiusKm: nullableNumber(0.5, 500).optional(),
  acceptedMaterials: z
    .array(materialCategorySchema)
    .max(MATERIAL_CATEGORIES.length)
    .transform((arr) => Array.from(new Set(arr)))
    .optional(),
});

export type ProfileInput = z.infer<typeof profileInputSchema>;

function decodeAcceptedMaterials(raw: string | null): MaterialCategory[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is MaterialCategory =>
      (MATERIAL_CATEGORIES as readonly string[]).includes(v),
    );
  } catch {
    return [];
  }
}

function toDTO(
  userId: string,
  row: {
    displayName: string | null;
    bio: string | null;
    organisationName: string | null;
    registrationId: string | null;
    serviceAreaLocality: string | null;
    serviceAreaRadiusKm: number | null;
    acceptedMaterials: string | null;
    updatedAt: Date;
  } | null,
): ProfileDTO {
  return {
    userId,
    displayName: row?.displayName ?? null,
    bio: row?.bio ?? null,
    organisationName: row?.organisationName ?? null,
    registrationId: row?.registrationId ?? null,
    serviceAreaLocality: row?.serviceAreaLocality ?? null,
    serviceAreaRadiusKm: row?.serviceAreaRadiusKm ?? null,
    acceptedMaterials: decodeAcceptedMaterials(row?.acceptedMaterials ?? null),
    updatedAt: row?.updatedAt ?? null,
  };
}

export async function getProfileForUser(userId: string): Promise<ProfileDTO> {
  const row = await db.profile.findUnique({ where: { userId } });
  return toDTO(userId, row);
}

export async function updateProfileForUser(
  userId: string,
  input: unknown,
): Promise<ProfileDTO> {
  if (await isUserSuspended(userId)) throw new ProfileError("suspended");
  const data = profileInputSchema.parse(input);

  // Only include fields the caller actually provided. undefined = leave the
  // column alone; null = clear it. The ProfileForm always sends every field,
  // but this makes direct API callers safe from accidentally wiping fields.
  const update: Record<string, string | number | null> = {};
  if (data.displayName !== undefined) update.displayName = data.displayName;
  if (data.bio !== undefined) update.bio = data.bio;
  if (data.organisationName !== undefined)
    update.organisationName = data.organisationName;
  if (data.registrationId !== undefined)
    update.registrationId = data.registrationId;
  if (data.serviceAreaLocality !== undefined)
    update.serviceAreaLocality = data.serviceAreaLocality;
  if (data.serviceAreaRadiusKm !== undefined)
    update.serviceAreaRadiusKm = data.serviceAreaRadiusKm;
  if (data.acceptedMaterials !== undefined)
    update.acceptedMaterials = JSON.stringify(data.acceptedMaterials);

  const row = await db.profile.upsert({
    where: { userId },
    create: { userId, ...update },
    update,
  });

  return toDTO(userId, row);
}

export async function computeReputation(userId: string): Promise<ReputationSummary> {
  const user = await db.user.findUnique({ where: { id: userId } });
  const memberSince = user?.createdAt ?? new Date(0);

  const [
    completedAsSeller,
    completedAsCollector,
    cancelledOrExpiredSeller,
    cancelledOrExpiredCollector,
    failedSeller,
    failedCollector,
    rating,
  ] = await Promise.all([
    db.connection.count({ where: { sellerId: userId, status: "COMPLETED" } }),
    db.connection.count({
      where: { collectorId: userId, status: "COMPLETED" },
    }),
    db.connection.count({
      where: { sellerId: userId, status: { in: ["CANCELLED", "EXPIRED"] } },
    }),
    db.connection.count({
      where: {
        collectorId: userId,
        status: { in: ["CANCELLED", "EXPIRED"] },
      },
    }),
    db.connection.count({ where: { sellerId: userId, status: "FAILED" } }),
    db.connection.count({ where: { collectorId: userId, status: "FAILED" } }),
    getRatingSummary(userId),
  ]);

  return {
    completedAsSeller,
    completedAsCollector,
    cancelledOrExpired: cancelledOrExpiredSeller + cancelledOrExpiredCollector,
    failed: failedSeller + failedCollector,
    memberSince,
    rating,
  };
}

export async function getPublicProfile(
  userId: string,
): Promise<PublicProfile | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { roles: true, profile: true },
  });
  if (!user) return null;

  const dto = toDTO(userId, user.profile);
  const reputation = await computeReputation(userId);

  return {
    userId,
    displayName: dto.displayName,
    bio: dto.bio,
    organisationName: dto.organisationName,
    registrationId: dto.registrationId,
    serviceAreaLocality: dto.serviceAreaLocality,
    serviceAreaRadiusKm: dto.serviceAreaRadiusKm,
    acceptedMaterials: dto.acceptedMaterials,
    roles: user.roles.map((r) => r.role as Role),
    reputation,
    isSuspended: user.suspendedAt !== null,
  };
}
