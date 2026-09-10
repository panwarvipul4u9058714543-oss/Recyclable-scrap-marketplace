import { ZodError } from "zod";
import { RouteError, type RouteErrorCode } from "./routes";

const STATUS: Record<RouteErrorCode, number> = {
  not_found: 404,
  forbidden: 403,
  not_a_collector: 403,
  suspended: 403,
  not_active: 409,
};

/**
 * Translate an error thrown by the routes service into an HTTP status and
 * response body. Validation errors become 400s; domain errors map by code.
 */
export function routeErrorPayload(err: unknown): {
  status: number;
  body: Record<string, unknown>;
} {
  if (err instanceof ZodError) {
    return {
      status: 400,
      body: { error: "invalid_request", details: err.flatten() },
    };
  }
  if (err instanceof RouteError) {
    return { status: STATUS[err.code], body: { error: err.code } };
  }
  throw err;
}
