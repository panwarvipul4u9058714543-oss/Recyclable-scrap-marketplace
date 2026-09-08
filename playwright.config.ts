import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Use the Chromium pre-installed in this environment rather than
        // downloading one. Falls back to Playwright's managed browser locally
        // when the pinned version's browser is available.
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
          : {},
      },
    },
  ],
  webServer: {
    // Run the dev server so the mocked one-time code (devCode) is returned and
    // the registration flow can be driven end to end. A dedicated e2e database
    // (provisioned in globalSetup) keeps this isolated from local dev data.
    command: "npm run dev -- --port 3000",
    url: "http://127.0.0.1:3000",
    // Always start a dedicated server so tests never reuse a developer's dev
    // server (which would run against dev.db and ignore this env block).
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: "file:./e2e.db",
      // Expose the mocked OTP so the e2e flow can read and submit it.
      RSM_EXPOSE_OTP: "1",
    },
  },
});
