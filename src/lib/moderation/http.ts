import { ZodError } from "zod";
import {
  ModerationError,
  type ModerationErrorCode,
} from "./moderation";

const STATUS: Record<ModerationErrorCode, number> = {
  forbidden: 403,
  not_found: 404,
  already_decided: 409,
  own_target: 422,
  not_suspended: 409,
  already_suspended: 409,
};

/**
 * Translate an error thrown by the moderation service into an HTTP status
 * and response body. Validation errors become 400s; domain errors map by
 * code; anything unexpected is re-thrown so it surfaces as a 500.
 */
export function moderationErrorPayload(err: unknown): {
  status: number;
  body: Record<string, unknown>;
} {
  if (err instanceof ZodError) {
    return {
      status: 400,
      body: { error: "invalid_request", details: err.flatten() },
    };
  }
  if (err instanceof ModerationError) {
    return { status: STATUS[err.code], body: { error: err.code } };
  }
  throw err;
}
