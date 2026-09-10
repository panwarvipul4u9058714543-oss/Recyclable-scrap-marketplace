import { test, expect, type Page } from "@playwright/test";

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

// Extract the current user's own id from the dashboard's profile link.
async function currentUserId(page: Page): Promise<string> {
  await page.goto("/profile");
  const href = await page
    .locator('a[href^="/u/"]')
    .first()
    .getAttribute("href");
  expect(href).toMatch(/^\/u\//);
  return href!.replace("/u/", "");
}

test("a collector blocks a seller and stops seeing their listings", async ({
  page,
}) => {
  // 1) Household seller posts a listing.
  await register(page, ["Household"], 500);
  await page.getByRole("link", { name: "Manage your listings" }).click();
  await page.getByRole("link", { name: "+ New listing" }).click();

  await page.getByLabel("Material category").selectOption("PLASTIC");
  await page.getByLabel("Title").fill("Clean PET bottles blockable");
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

  const sellerId = await currentUserId(page);

  await page.goto("/dashboard");
  await logout(page);

  // 2) A collector browses nearby and sees the listing.
  await register(page, ["Collector (Kabadiwala)"], 501);
  await page.getByRole("link", { name: "Browse nearby listings" }).click();
  await page.getByLabel("Latitude").fill("12.9352");
  await page.getByLabel("Longitude").fill("77.6245");
  await page.getByLabel("Maximum distance (km)").fill("50");
  await page.getByRole("button", { name: "Show nearby listings" }).click();

  const results = page.getByRole("region", { name: "Search results" });
  await expect(results).toContainText("Clean PET bottles blockable");

  // 3) The collector opens the seller's public profile and blocks them.
  await page.goto(`/u/${sellerId}`);
  await page.getByRole("button", { name: "Block user" }).click();
  await expect(page.getByRole("status")).toHaveText("User blocked.");

  // 4) Back on /nearby, the seller's listing is gone.
  await page.goto("/nearby");
  await page.getByLabel("Latitude").fill("12.9352");
  await page.getByLabel("Longitude").fill("77.6245");
  await page.getByLabel("Maximum distance (km)").fill("50");
  await page.getByRole("button", { name: "Show nearby listings" }).click();

  const resultsAfter = page.getByRole("region", { name: "Search results" });
  await expect(resultsAfter).not.toContainText("Clean PET bottles blockable");
});
