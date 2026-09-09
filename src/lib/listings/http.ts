import { ZodError } from "zod";
import { ListingError, type ListingErrorCode } from "./listings";

const STATUS: Record<ListingErrorCode, number> = {
  not_found: 404,
  forbidden: 403,
  closed: 409,
  invalid_seller_type: 422,
  invalid_transition: 409,
  prohibited_content: 422,
  suspended: 403,
};

/**
 * Translate an error thrown by the listings service into an HTTP status and
 * response body. Validation errors become 400s; domain errors map by code.
 * Anything unexpected is re-thrown so it surfaces as a 500.
 */
export function listingErrorPayload(err: unknown): {
  status: number;
  body: Record<string, unknown>;
} {
  if (err instanceof ZodError) {
    return {
      status: 400,
      body: { error: "invalid_listing", details: err.flatten() },
    };
  }
  if (err instanceof ListingError) {
    return { status: STATUS[err.code], body: { error: err.code } };
  }
  throw err;
}
