import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

// Point straight at the dedicated e2e database provisioned in global-setup.ts;
// the default DATABASE_URL from .env points at dev.db and would miss the rows
// the running app is actually reading. Prisma resolves `file:` URLs relative
// to the schema file location, so an absolute URL is the safe form here.
const e2eDbUrl = `file:${path.resolve(process.cwd(), "prisma/e2e.db")}`;
const db = new PrismaClient({
  datasources: { db: { url: e2eDbUrl } },
});

function uniquePhone(seed: number) {
  const suffix = (Date.now() + seed).toString().slice(-9).padStart(9, "0");
  return `+1${suffix}`;
}

async function register(page: Page, roles: string[], seed: number) {
  const phone = uniquePhone(seed);
  await page.goto("/register");
  await page.getByLabel("Phone number").fill(phone);
  await page.getByRole("button", { name: "Send code" }).click();

  const devCode = page.locator("strong").first();
  await expect(devCode).toHaveText(/^\d{6}$/);
  const code = (await devCode.textContent())!.trim();

  await page.getByLabel("Verification code").fill(code);
  await page.getByRole("button", { name: "Verify" }).click();

  for (const role of roles) await page.getByLabel(role).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  return phone;
}

async function logout(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
}

async function grantAdmin(phone: string) {
  await db.user.update({ where: { phone }, data: { isAdmin: true } });
}

test("an operator suspends a reported seller and their listing drops off /nearby", async ({
  page,
}) => {
  // 1) A household seller posts a listing.
  const sellerPhone = await register(page, ["Household"], 900);
  await page.getByRole("link", { name: "Manage your listings" }).click();
  await page.getByRole("link", { name: "+ New listing" }).click();

  await page.getByLabel("Material category").selectOption("PLASTIC");
  await page.getByLabel("Title").fill("Suspendable PET bottles");
  await page
    .getByLabel("Photo URLs (one per line)")
    .fill("https://example.com/bottles.jpg");
  await page.getByLabel("From", { exact: true }).fill("5");
  await page.getByLabel("To", { exact: true }).fill("8");
  await page.getByLabel("Approximate locality").fill("HSR Layout, Bengaluru");
  await page.getByLabel("Latitude").fill("12.9110");
  await page.getByLabel("Longitude").fill("77.6470");
  await page.getByRole("button", { name: "Publish listing" }).click();
  await expect(page).toHaveURL(/\/listings$/);
  await page.goto("/dashboard");
  await logout(page);

  // 2) A collector reports the seller from their public profile.
  await register(page, ["Collector (Kabadiwala)"], 901);
  const sellerRow = await db.user.findUnique({ where: { phone: sellerPhone } });
  expect(sellerRow).not.toBeNull();

  await page.goto(`/u/${sellerRow!.id}`);
  await page.getByRole("button", { name: "Report user" }).click();
  await page.getByLabel("Reason").selectOption("harassment");
  await page.getByRole("button", { name: "Submit report" }).click();
  await expect(page.getByRole("status")).toContainText("Report submitted");
  await page.goto("/dashboard");
  await logout(page);

  // 3) An operator (isAdmin) reviews the moderation queue and suspends the
  //    seller.
  const adminPhone = await register(page, ["Collector (Kabadiwala)"], 902);
  await grantAdmin(adminPhone);
  await page.goto("/moderation");
  await expect(
    page.getByRole("heading", { level: 1, name: "Moderation queue" }),
  ).toBeVisible();

  const openReport = page.getByRole("article", { name: "Open report" }).first();
  await expect(openReport).toContainText(`user ${sellerPhone}`);
  await openReport
    .getByLabel("Suspend the reported account (reason)")
    .fill("Repeated harassment reports.");
  await openReport.getByRole("button", { name: "Suspend account" }).click();

  await expect(
    page.getByRole("article", { name: "Suspended account" }),
  ).toContainText(sellerPhone);

  // 4) An unrelated collector no longer sees the suspended seller's listing.
  await page.goto("/dashboard");
  await logout(page);

  await register(page, ["Collector (Kabadiwala)"], 903);
  await page.goto("/nearby");
  await page.getByLabel("Latitude").fill("12.9110");
  await page.getByLabel("Longitude").fill("77.6470");
  await page.getByLabel("Maximum distance (km)").fill("50");
  await page.getByRole("button", { name: "Show nearby listings" }).click();

  const results = page.getByRole("region", { name: "Search results" });
  await expect(results).not.toContainText("Suspendable PET bottles");
});
