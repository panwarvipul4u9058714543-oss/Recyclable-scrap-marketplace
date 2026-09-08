import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

// Vitest global setup: build a fresh SQLite schema for the test database once
// per run. Individual tests reset row data between cases via resetDb().
const TEST_DATABASE_URL = "file:./test.db";

export default function setup() {
  // Start from a clean file so schema changes never leak across runs.
  rmSync("prisma/test.db", { force: true });
  rmSync("prisma/test.db-journal", { force: true });

  execSync("npx prisma db push --skip-generate --force-reset", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
