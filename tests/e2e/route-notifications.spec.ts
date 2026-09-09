import { test, expect, type Page } from "@playwright/test";

// Re-usable phone helper: same seed → different phone across runs, but stable
// within one test so the collector can "sign back in" by re-running register
// with the same phone (getOrCreateUserByPhone reuses the existing account).
function phoneForSeed(seed: number) {
  const suffix = (Date.now() + seed).toString().slice(-9).padStart(9, "0");
  return `+1${suffix}`;
}

async function verifyPhone(page: Page, phone: string) {
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
  await verifyPhone(page, phone);
  for (const role of roles) await page.getByLabel(role).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

// After the first register the user already holds their roles; a repeat
// verify lands on the role picker again but "Continue" without changes is
// still valid because the existing role selection is preserved server-side.
async function signInAgain(page: Page, phone: string) {
  await verifyPhone(page, phone);
  // Role picker is shown again; keep whatever they already had.
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function logout(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
}

test("a listing posted after the collector starts a route surfaces on /route recent matches", async ({
  page,
}) => {
  const collectorPhone = phoneForSeed(810);
  const sellerPhone = phoneForSeed(811);

  // 1) Collector opens route mode on HSR → Whitefield.
  await registerWithRoles(page, collectorPhone, ["Collector (Kabadiwala)"]);
  await page.goto("/route");
  await page.getByLabel("Origin latitude").fill("12.9110");
  await page.getByLabel("Origin longitude").fill("77.6470");
  await page.getByLabel("Destination latitude").fill("12.9698");
  await page.getByLabel("Destination longitude").fill("77.7500");
  await page.getByLabel("Maximum detour (km)").fill("5");
  await page
    .getByRole("button", { name: "Start route and find matches" })
    .click();
  await expect(
    page.getByRole("region", { name: "Route matches" }),
  ).toBeVisible();
  await page.goto("/dashboard");
  await logout(page);

  // 2) A seller posts a listing near the midpoint of the collector's trip.
  await registerWithRoles(page, sellerPhone, ["Household"]);
  await page.getByRole("link", { name: "Manage your listings" }).click();
  await page.getByRole("link", { name: "+ New listing" }).click();

  await page.getByLabel("Material category").selectOption("PLASTIC");
  await page.getByLabel("Title").fill("Fan-out route notification");
  await page
    .getByLabel("Photo URLs (one per line)")
    .fill("https://example.com/x.jpg");
  await page.getByLabel("From", { exact: true }).fill("3");
  await page.getByLabel("To", { exact: true }).fill("6");
  await page
    .getByLabel("Approximate locality")
    .fill("Bellandur, Bengaluru");
  await page.getByLabel("Latitude").fill("12.9404");
  await page.getByLabel("Longitude").fill("77.6985");
  await page.getByRole("button", { name: "Publish listing" }).click();
  await expect(page).toHaveURL(/\/listings$/);
  await page.goto("/dashboard");
  await logout(page);

  // 3) The collector signs back in with the same phone and sees the new
  //    listing as an unseen route match on /route.
  await signInAgain(page, collectorPhone);
  await page.goto("/route");

  const recent = page.getByRole("region", { name: "Recent route matches" });
  await expect(recent).toContainText("Fan-out route notification");
  const newRow = recent
    .getByRole("listitem", { name: "New route match" })
    .filter({ hasText: "Fan-out route notification" });
  await expect(newRow).toBeVisible();

  await newRow.getByRole("button", { name: "Mark as seen" }).click();
  // After router.refresh() the row is now a plain "Route match" (no NEW badge).
  await expect(
    recent
      .getByRole("listitem", { name: "New route match" })
      .filter({ hasText: "Fan-out route notification" }),
  ).toHaveCount(0);
});
