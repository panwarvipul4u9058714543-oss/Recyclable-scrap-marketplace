import { test, expect, type Page } from "@playwright/test";

// A unique phone per run keeps the test independent of existing rows.
function uniquePhone(seed: number) {
  const suffix = (Date.now() + seed).toString().slice(-9).padStart(9, "0");
  return `+1${suffix}`;
}

/**
 * Register + verify an account with the given roles and land on the dashboard.
 * Returns the phone that was registered.
 */
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

test("a collector discovers a household's nearby listing", async ({
  page,
}) => {
  // 1) Household seller creates a listing near Koramangala.
  await register(page, ["Household"], 1);
  await page.getByRole("link", { name: "Manage your listings" }).click();
  await page.getByRole("link", { name: "+ New listing" }).click();

  await page.getByLabel("Material category").selectOption("PLASTIC");
  await page.getByLabel("Title").fill("Clean PET bottles, ~6 kg");
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
  await expect(page.locator("li", { hasText: "Clean PET bottles" })).toBeVisible();

  // 2) The seller logs out.
  await page.goto("/dashboard");
  await logout(page);

  // 3) A collector registers and browses nearby listings from ~3km away.
  await register(page, ["Collector (Kabadiwala)"], 2);
  await page.getByRole("link", { name: "Browse nearby listings" }).click();
  await expect(page).toHaveURL(/\/nearby$/);

  await page.getByLabel("Latitude").fill("12.9719");
  await page.getByLabel("Longitude").fill("77.6412");
  await page.getByLabel("Material").selectOption("PLASTIC");
  await page.getByLabel("Maximum distance (km)").fill("10");
  await page.getByRole("button", { name: "Show nearby listings" }).click();

  // 4) The listing appears with a plausible distance.
  const results = page.getByRole("region", { name: "Search results" });
  await expect(results).toContainText("Clean PET bottles");
  await expect(results).toContainText(/\d+\.\d km/);

  // 5) Filtering by a different material hides it.
  await page.getByLabel("Material").selectOption("PAPER");
  await page.getByRole("button", { name: "Show nearby listings" }).click();
  await expect(results).toContainText("No nearby listings match those filters.");
});

test("a household without a collector role gets a role-specific message", async ({
  page,
}) => {
  await register(page, ["Household"], 3);
  await page.goto("/nearby");
  await expect(page.getByRole("heading", { name: "Nearby listings" })).toBeVisible();
  await expect(page.getByText(/for collectors, dealers and recyclers/i)).toBeVisible();
});
