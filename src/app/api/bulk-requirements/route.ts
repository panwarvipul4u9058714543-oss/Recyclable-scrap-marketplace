import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { bulkRequirementErrorPayload } from "@/lib/bulk/http";
import {
  createBulkRequirement,
  listBulkRequirementsForBuyer,
  searchBulkRequirements,
  type SearchBulkRequirementsInput,
} from "@/lib/bulk/requirements";
import { materialCategorySchema, quantityUnitSchema } from "@/lib/materials";
import { roleSchema } from "@/lib/roles";

const searchQuerySchema = z.object({
  scope: z.enum(["mine", "browse"]).default("browse"),
  material: materialCategorySchema.optional(),
  supplyQuantity: z.coerce.number().positive().optional(),
  supplyQuantityUnit: quantityUnitSchema.optional(),
  region: z.string().trim().min(1).max(120).optional(),
  buyerRole: roleSchema.optional(),
});

/**
 * GET /api/bulk-requirements
 *   ?scope=mine  → the caller's own requirements (buyer view)
 *   ?scope=browse (default) → public search with optional filters
 * POST /api/bulk-requirements → create a new requirement (bulk-buyer only)
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const url = new URL(request.url);
  const parsed = searchQuerySchema.safeParse(
    Object.fromEntries(url.searchParams.entries()),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const q = parsed.data;
  if (q.scope === "mine") {
    const requirements = await listBulkRequirementsForBuyer(user.id);
    return NextResponse.json({ requirements });
  }
  const criteria: SearchBulkRequirementsInput = {
    material: q.material,
    supplyQuantity: q.supplyQuantity,
    supplyQuantityUnit: q.supplyQuantityUnit,
    region: q.region,
    buyerRole: q.buyerRole,
    viewerId: user.id,
  };
  const requirements = await searchBulkRequirements(criteria);
  return NextResponse.json({ requirements });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => null);
    const requirement = await createBulkRequirement(user.id, body);
    return NextResponse.json({ requirement }, { status: 201 });
  } catch (err) {
    const { status, body } = bulkRequirementErrorPayload(err);
    return NextResponse.json(body, { status });
  }
}
