import { ZodError } from "zod";
import {
  BulkResponseError,
  type BulkResponseErrorCode,
} from "./responses";

const STATUS: Record<BulkResponseErrorCode, number> = {
  not_found: 404,
  forbidden: 403,
  not_a_bulk_supplier: 403,
  requirement_not_active: 409,
  own_requirement: 409,
  already_selected: 409,
  not_pending: 409,
  not_selected: 409,
  empty_message: 400,
  invalid_outcome: 400,
  blocked: 403,
  suspended: 403,
};

/**
 * Translate an error thrown by the bulk-response service into an HTTP status
 * and body. ZodErrors become 400s; domain errors map by code.
 */
export function bulkResponseErrorPayload(err: unknown): {
  status: number;
  body: Record<string, unknown>;
} {
  if (err instanceof ZodError) {
    return {
      status: 400,
      body: { error: "invalid_request", details: err.flatten() },
    };
  }
  if (err instanceof BulkResponseError) {
    return { status: STATUS[err.code], body: { error: err.code } };
  }
  throw err;
}
