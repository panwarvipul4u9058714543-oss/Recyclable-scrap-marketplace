import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

// Provision a dedicated SQLite database for the e2e run so tests never touch
// the local dev database. The DATABASE_URL here must match the one the e2e web
// server is started with in playwright.config.ts.
const E2E_DATABASE_URL = "file:./e2e.db";

export default function globalSetup() {
  rmSync("prisma/e2e.db", { force: true });
  rmSync("prisma/e2e.db-journal", { force: true });

  execSync("npx prisma db push --skip-generate --force-reset", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL },
  });
}
