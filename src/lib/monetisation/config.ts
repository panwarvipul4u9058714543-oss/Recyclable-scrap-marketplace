/**
 * Monetisation feature flag. Set the env var to "0" (or unset it, since the
 * default is off) to disable all paid features safely — writes are refused
 * and reads return empty. This is the "can be disabled safely" acceptance
 * criterion from issue #8: everything monetisation-related routes through
 * `isMonetisationEnabled()` so a single flag flip is the whole switch.
 *
 * Basic listing and discovery never depend on monetisation being on; only
 * the paid surfaces do.
 */
export function isMonetisationEnabled(): boolean {
  const raw = process.env.MONETISATION_ENABLED;
  return raw === "1" || raw?.toLowerCase() === "true";
}
