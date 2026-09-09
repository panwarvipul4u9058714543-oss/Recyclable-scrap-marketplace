import { ZodError } from "zod";
import {
  BulkRequirementError,
  type BulkRequirementErrorCode,
} from "./requirements";

const STATUS: Record<BulkRequirementErrorCode, number> = {
  not_found: 404,
  forbidden: 403,
  closed: 409,
  not_a_bulk_buyer: 403,
  suspended: 403,
};

/**
 * Translate an error thrown by the bulk service into an HTTP status and
 * response body. Validation errors become 400s; domain errors map by code.
 */
export function bulkRequirementErrorPayload(err: unknown): {
  status: number;
  body: Record<string, unknown>;
} {
  if (err instanceof ZodError) {
    return {
      status: 400,
      body: { error: "invalid_request", details: err.flatten() },
    };
  }
  if (err instanceof BulkRequirementError) {
    return { status: STATUS[err.code], body: { error: err.code } };
  }
  throw err;
}
