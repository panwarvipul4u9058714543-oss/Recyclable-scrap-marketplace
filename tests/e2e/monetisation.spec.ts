import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

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

test("monetisation: pro seller promotes a listing and the badge shows on nearby", async ({
  page,
}) => {
  // Pro seller creates an active listing.
  const proPhone = await register(page, ["Business"], 900);
  await page.getByRole("link", { name: "Manage your listings" }).click();
  await page.getByRole("link", { name: "+ New listing" }).click();
  await page.getByLabel("Material category").selectOption("PLASTIC");
  await page.getByLabel("Title").fill("Promoted PET");
  await page
    .getByLabel("Photo URLs (one per line)")
    .fill("https://example.com/x.jpg");
  await page.getByLabel("From", { exact: true }).fill("5");
  await page.getByLabel("To", { exact: true }).fill("10");
  await page.getByLabel("Approximate locality").fill("Monetise Locality");
  await page.getByLabel("Latitude").fill("12.9110");
  await page.getByLabel("Longitude").fill("77.6470");
  await page.getByRole("button", { name: "Publish listing" }).click();
  await expect(page).toHaveURL(/\/listings$/);

  // Pro user visits the monetisation catalog and promotes the listing.
  await page.goto("/monetisation");
  await expect(page.getByRole("heading", { name: "Paid features" })).toBeVisible();
  await page.getByRole("link", { name: /Promote .Promoted PET/ }).click();
  await expect(
    page.getByRole("heading", { name: /Promote/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Purchase Premium promotion" })
    .click();
  await expect(page.getByText(/activated/)).toBeVisible();

  // Sign out and log in as a collector to see the promoted badge in nearby.
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Sign out" }).click();
  await register(page, ["Collector (Kabadiwala)"], 901);
  await page.goto("/nearby");
  await page.getByLabel("Latitude").fill("12.9110");
  await page.getByLabel("Longitude").fill("77.6470");
  await page.getByLabel("Maximum distance (km)").fill("50");
  await page.getByRole("button", { name: "Show nearby listings" }).click();
  const results = page.getByRole("region", { name: "Search results" });
  await expect(results).toContainText("Promoted PET");
  await expect(results.getByText("Featured", { exact: true })).toBeVisible();
});

test("monetisation: admin creates an ad placement that renders on nearby", async ({
  page,
}) => {
  // Admin creates a placement on the DISCOVERY surface.
  const adminPhone = await register(page, ["Household"], 910);
  await grantAdmin(adminPhone);
  // Refresh so the dashboard notices the admin flag.
  await page.goto("/admin/monetisation");
  await expect(
    page.getByRole("heading", { name: "Monetisation" }),
  ).toBeVisible();
  const form = page.getByRole("form", { name: "New ad placement" });
  await form.getByLabel("Headline").fill("Try our recycling pickup");
  await form
    .getByLabel("Body")
    .fill("City-wide same-day pickup for professional buyers.");
  await form.getByLabel("Link URL").fill("https://example.com/recycle");
  await form.getByRole("button", { name: /Create placement/ }).click();
  await expect(
    page.getByText(/Try our recycling pickup/).first(),
  ).toBeVisible();

  // Sign out and log in as a collector; visit /nearby and confirm the panel.
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Sign out" }).click();
  await register(page, ["Collector (Kabadiwala)"], 911);
  await page.goto("/nearby");
  const sponsored = page.getByRole("complementary", { name: "Sponsored" });
  await expect(sponsored).toBeVisible();
  await expect(sponsored).toContainText("Try our recycling pickup");
});
