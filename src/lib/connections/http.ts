import { ZodError } from "zod";
import { ConnectionError, type ConnectionErrorCode } from "./connections";

const STATUS: Record<ConnectionErrorCode, number> = {
  not_found: 404,
  forbidden: 403,
  listing_not_active: 409,
  not_a_collector: 403,
  not_interested: 409,
  already_selected: 409,
  own_listing: 422,
  not_reserved: 409,
  empty_message: 400,
};

/**
 * Translate an error thrown by the connections service into an HTTP status
 * and response body. Validation errors become 400s; domain errors map by
 * code; anything unexpected is re-thrown so it surfaces as a 500.
 */
export function connectionErrorPayload(err: unknown): {
  status: number;
  body: Record<string, unknown>;
} {
  if (err instanceof ZodError) {
    return {
      status: 400,
      body: { error: "invalid_request", details: err.flatten() },
    };
  }
  if (err instanceof ConnectionError) {
    return { status: STATUS[err.code], body: { error: err.code } };
  }
  throw err;
}
