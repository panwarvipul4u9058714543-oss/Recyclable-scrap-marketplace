import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

// Point straight at the dedicated e2e database provisioned in global-setup.ts.
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

async function grantAdmin(phone: string) {
  await db.user.update({ where: { phone }, data: { isAdmin: true } });
}

test("marketplace analytics: admin sees KPIs derived from marketplace activity", async ({
  page,
}) => {
  // A household seller creates a listing (records LISTING_CREATED); a
  // collector views the /nearby feed (records LISTING_VIEWED per listing);
  // the collector expresses interest (records INTEREST_EXPRESSED).
  const sellerPhone = await register(page, ["Household"], 810);
  await page.getByRole("link", { name: "Manage your listings" }).click();
  await page.getByRole("link", { name: "+ New listing" }).click();
  await page.getByLabel("Material category").selectOption("PLASTIC");
  await page.getByLabel("Title").fill("Analytics-tracked PET");
  await page
    .getByLabel("Photo URLs (one per line)")
    .fill("https://example.com/x.jpg");
  await page.getByLabel("From", { exact: true }).fill("5");
  await page.getByLabel("To", { exact: true }).fill("10");
  await page.getByLabel("Approximate locality").fill("Analytics Locality");
  await page.getByLabel("Latitude").fill("12.9110");
  await page.getByLabel("Longitude").fill("77.6470");
  await page.getByRole("button", { name: "Publish listing" }).click();
  await expect(page).toHaveURL(/\/listings$/);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Sign out" }).click();

  await register(page, ["Collector (Kabadiwala)"], 811);
  await page.goto("/nearby");
  await page.getByLabel("Latitude").fill("12.9110");
  await page.getByLabel("Longitude").fill("77.6470");
  await page.getByLabel("Maximum distance (km)").fill("50");
  await page.getByRole("button", { name: "Show nearby listings" }).click();
  await expect(
    page.getByRole("region", { name: "Search results" }),
  ).toContainText("Analytics-tracked PET");
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Sign out" }).click();

  // Admin views the analytics page.
  const adminPhone = await register(page, ["Collector (Kabadiwala)"], 812);
  await grantAdmin(adminPhone);
  await page.goto("/dashboard");
  await expect(
    page.getByRole("link", { name: "Marketplace analytics" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Marketplace analytics" }).click();
  await expect(page).toHaveURL(/\/admin\/analytics$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Marketplace analytics" }),
  ).toBeVisible();

  // Headline tiles are present (scope to the Headline KPIs region to avoid
  // the same word appearing later as a table header).
  const headline = page.getByRole("region", { name: "Headline KPIs" });
  await expect(headline.getByText("Registrations", { exact: true })).toBeVisible();
  await expect(headline.getByText("Listings", { exact: true })).toBeVisible();
  await expect(headline.getByText("Listing views", { exact: true })).toBeVisible();

  // Density tables show at least the locality we seeded.
  await expect(
    page.getByRole("region", { name: "Supply and demand" }),
  ).toContainText("Analytics Locality");

  // The channel-breakdown table is present with the three channels.
  const channels = page.getByRole("region", { name: "Channel breakdown" });
  await expect(channels).toContainText("HOUSEHOLD");
  await expect(channels).toContainText("ROUTE");
  await expect(channels).toContainText("BULK");

  // Refuse access to a non-admin — they get a 404 shell, not the KPI page.
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Sign out" }).click();
  await register(page, ["Household"], 813);
  const res = await page.goto("/admin/analytics");
  expect(res?.status()).toBe(404);
  expect(sellerPhone).toMatch(/^\+1\d+$/);
});
