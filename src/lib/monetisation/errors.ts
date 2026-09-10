export type MonetisationErrorCode =
  | "disabled"
  | "not_professional"
  | "forbidden"
  | "not_found"
  | "already_active"
  | "invalid_transition";

/** Domain error the API layer maps to an HTTP status. */
export class MonetisationError extends Error {
  constructor(public readonly code: MonetisationErrorCode) {
    super(code);
    this.name = "MonetisationError";
  }
}
