import { test, expect, type Page } from "@playwright/test";

// A unique phone per run keeps the test independent of existing rows.
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

// Re-verify an already-registered phone. The role step preloads existing
// roles, so we just click Continue to land back on the dashboard.
async function signBackIn(page: Page, phone: string) {
  await page.goto("/register");
  await page.getByLabel("Phone number").fill(phone);
  await page.getByRole("button", { name: "Send code" }).click();
  const devCode = page.locator("strong").first();
  await expect(devCode).toHaveText(/^\d{6}$/);
  const code = (await devCode.textContent())!.trim();
  await page.getByLabel("Verification code").fill(code);
  await page.getByRole("button", { name: "Verify" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function createListing(page: Page, title: string) {
  await page.getByRole("link", { name: "Manage your listings" }).click();
  await page.getByRole("link", { name: "+ New listing" }).click();

  await page.getByLabel("Material category").selectOption("PLASTIC");
  await page.getByLabel("Title").fill(title);
  await page
    .getByLabel("Photo URLs (one per line)")
    .fill("https://example.com/bottles.jpg");
  await page.getByLabel("From", { exact: true }).fill("5");
  await page.getByLabel("To", { exact: true }).fill("8");
  await page.getByLabel("Approximate locality").fill("Koramangala, Bengaluru");
  await page.getByLabel("Latitude").fill("12.9352");
  await page.getByLabel("Longitude").fill("77.6245");
  await page.getByRole("button", { name: "Publish listing" }).click();
  await expect(page).toHaveURL(/\/listings$/);
}

test("a collector expresses interest and the seller selects them", async ({
  page,
}) => {
  // 1) Seller registers and posts a listing.
  const sellerPhone = await register(page, ["Household"], 10);
  await createListing(page, "Old newspapers");

  // 2) Seller signs out.
  await page.goto("/dashboard");
  await logout(page);

  // 3) Collector registers and expresses interest from /nearby.
  const collectorPhone = await register(page, ["Collector (Kabadiwala)"], 11);
  await page.getByRole("link", { name: "Browse nearby listings" }).click();
  await page.getByLabel("Latitude").fill("12.9352");
  await page.getByLabel("Longitude").fill("77.6245");
  await page.getByRole("button", { name: "Show nearby listings" }).click();

  const results = page.getByRole("region", { name: "Search results" });
  await expect(results).toContainText("Old newspapers");
  await results
    .getByRole("button", { name: "I'm interested" })
    .first()
    .click();
  await expect(
    results.getByRole("button", { name: "Withdraw interest" }),
  ).toBeVisible();

  // The collector's own connections page shows no accepted connection yet.
  await page.goto("/connections");
  await expect(page.getByText("No seller has selected you yet.")).toBeVisible();

  // 4) Collector signs out; seller signs back in via the same registered phone.
  await page.goto("/dashboard");
  await logout(page);
  await signBackIn(page, sellerPhone);

  // 5) Seller sees the interested buyer and selects them.
  await page.getByRole("link", { name: "Manage your listings" }).click();
  const card = page.locator("li", { hasText: "Old newspapers" });
  await expect(card.getByText("Interested buyers")).toBeVisible();
  await expect(card.getByText(collectorPhone)).toBeVisible();
  await card.getByRole("button", { name: "Select" }).click();

  await expect(card.getByText("Selected buyer:")).toBeVisible();
  await expect(card.getByText(collectorPhone)).toBeVisible();

  // 6) The seller's connections page reflects the pick.
  await page.goto("/connections");
  const sellerSection = page.getByRole("region", { name: "As a seller" });
  await expect(sellerSection).toContainText("Old newspapers");
  await expect(sellerSection).toContainText(collectorPhone);

  // 7) Sign back into the collector and confirm they see the connection too.
  await page.goto("/dashboard");
  await logout(page);
  await signBackIn(page, collectorPhone);

  await page.getByRole("link", { name: "Your connections" }).click();
  const buyerSection = page.getByRole("region", { name: "As a buyer" });
  await expect(buyerSection).toContainText("Old newspapers");
  await expect(buyerSection).toContainText(sellerPhone);
});
