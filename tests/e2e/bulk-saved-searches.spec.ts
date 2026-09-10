import { test, expect, type Page } from "@playwright/test";

function phoneForSeed(seed: number) {
  const suffix = (Date.now() + seed).toString().slice(-9).padStart(9, "0");
  return `+1${suffix}`;
}

async function verify(page: Page, phone: string) {
  await page.goto("/register");
  await page.getByLabel("Phone number").fill(phone);
  await page.getByRole("button", { name: "Send code" }).click();
  const devCode = page.locator("strong").first();
  await expect(devCode).toHaveText(/^\d{6}$/);
  const code = (await devCode.textContent())!.trim();
  await page.getByLabel("Verification code").fill(code);
  await page.getByRole("button", { name: "Verify" }).click();
}

async function registerWithRoles(page: Page, phone: string, roles: string[]) {
  await verify(page, phone);
  for (const role of roles) await page.getByLabel(role).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function signInAgain(page: Page, phone: string) {
  await verify(page, phone);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function logout(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
}

test("a dealer saves a supply search and gets alerted when a matching listing is posted", async ({
  page,
}) => {
  const dealerPhone = phoneForSeed(970);
  const sellerPhone = phoneForSeed(971);

  // 1) Dealer signs up and saves a supply search.
  await registerWithRoles(page, dealerPhone, ["Scrap Dealer"]);
  await page.goto("/bulk");
  await page.getByRole("button", { name: "+ New saved search" }).click();
  await page.getByLabel("Name").fill("PET in Bengaluru");
  await page.getByLabel("Material (optional)").selectOption("PLASTIC");
  await page.getByLabel("Region contains (optional)").fill("Bengaluru");
  await page.getByRole("button", { name: "Save search" }).click();

  const searches = page.getByRole("region", { name: "Saved searches" });
  await expect(searches).toContainText("PET in Bengaluru");
  await page.goto("/dashboard");
  await logout(page);

  // 2) Household seller posts a matching listing.
  await registerWithRoles(page, sellerPhone, ["Household"]);
  await page.getByRole("link", { name: "Manage your listings" }).click();
  await page.getByRole("link", { name: "+ New listing" }).click();
  await page.getByLabel("Material category").selectOption("PLASTIC");
  await page.getByLabel("Title").fill("PET bottles from cafe");
  await page
    .getByLabel("Photo URLs (one per line)")
    .fill("https://example.com/x.jpg");
  await page.getByLabel("From", { exact: true }).fill("10");
  await page.getByLabel("To", { exact: true }).fill("40");
  await page
    .getByLabel("Approximate locality")
    .fill("Bengaluru South");
  await page.getByLabel("Latitude").fill("12.9110");
  await page.getByLabel("Longitude").fill("77.6470");
  await page.getByRole("button", { name: "Publish listing" }).click();
  await expect(page).toHaveURL(/\/listings$/);
  await page.goto("/dashboard");
  await logout(page);

  // 3) Dealer signs back in and sees the alert with NEW badge.
  await signInAgain(page, dealerPhone);
  await page.goto("/bulk");

  const alerts = page.getByRole("region", {
    name: "Recent saved-search alerts",
  });
  await expect(alerts).toContainText("PET bottles from cafe");
  const newRow = alerts
    .getByRole("listitem", { name: "New alert" })
    .filter({ hasText: "PET bottles from cafe" });
  await expect(newRow).toBeVisible();

  // Marking seen removes the NEW state.
  await newRow.getByRole("button", { name: "Mark as seen" }).click();
  await expect(
    alerts
      .getByRole("listitem", { name: "New alert" })
      .filter({ hasText: "PET bottles from cafe" }),
  ).toHaveCount(0);
});
