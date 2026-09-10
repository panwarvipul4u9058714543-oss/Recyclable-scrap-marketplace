import { ZodError } from "zod";
import {
  SavedSearchError,
  type SavedSearchErrorCode,
} from "./saved-searches";

const STATUS: Record<SavedSearchErrorCode, number> = {
  not_found: 404,
  forbidden: 403,
  not_a_bulk_buyer: 403,
};

export function savedSearchErrorPayload(err: unknown): {
  status: number;
  body: Record<string, unknown>;
} {
  if (err instanceof ZodError) {
    return {
      status: 400,
      body: { error: "invalid_request", details: err.flatten() },
    };
  }
  if (err instanceof SavedSearchError) {
    return { status: STATUS[err.code], body: { error: err.code } };
  }
  throw err;
}
