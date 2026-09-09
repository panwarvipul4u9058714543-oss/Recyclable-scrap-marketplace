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

test("a collector plans a route, finds an along-route listing and expresses interest", async ({
  page,
}) => {
  // 1) A household seller posts a listing near the midpoint of a trip
  //    HSR Layout → Whitefield.
  await register(page, ["Household"], 700);
  await page.getByRole("link", { name: "Manage your listings" }).click();
  await page.getByRole("link", { name: "+ New listing" }).click();

  await page.getByLabel("Material category").selectOption("PLASTIC");
  await page.getByLabel("Title").fill("Along-route PET bottles");
  await page
    .getByLabel("Photo URLs (one per line)")
    .fill("https://example.com/bottles.jpg");
  await page.getByLabel("From", { exact: true }).fill("5");
  await page.getByLabel("To", { exact: true }).fill("8");
  await page.getByLabel("Approximate locality").fill("Bellandur, Bengaluru");
  // Roughly on the straight line between the origin/destination below.
  await page.getByLabel("Latitude").fill("12.9404");
  await page.getByLabel("Longitude").fill("77.6985");
  await page.getByRole("button", { name: "Publish listing" }).click();
  await expect(page).toHaveURL(/\/listings$/);

  await page.goto("/dashboard");
  await logout(page);

  // 2) A collector opens /route and submits a trip HSR → Whitefield.
  await register(page, ["Collector (Kabadiwala)"], 701);
  await page.getByRole("link", { name: "Plan a route" }).click();
  await expect(page).toHaveURL(/\/route$/);

  await page.getByLabel("Origin latitude").fill("12.9110");
  await page.getByLabel("Origin longitude").fill("77.6470");
  await page.getByLabel("Destination latitude").fill("12.9698");
  await page.getByLabel("Destination longitude").fill("77.7500");
  await page.getByLabel("Maximum detour (km)").fill("5");
  await page
    .getByRole("button", { name: "Start route and find matches" })
    .click();

  // 3) The along-route listing appears in the route matches with a detour
  //    figure, and the collector can express interest from the same list.
  const matches = page.getByRole("region", { name: "Route matches", exact: true });
  await expect(matches).toContainText("Along-route PET bottles");
  await expect(matches).toContainText(/\+[\d.]+ km detour/);

  // Pin to this test's own listing — earlier tests in the run may have left
  // active listings around that also fall inside the route's detour bounds.
  const ownCard = matches
    .getByRole("listitem")
    .filter({ hasText: "Along-route PET bottles" });
  await ownCard.getByRole("button", { name: "I'm interested" }).click();
  await expect(
    ownCard.getByRole("button", { name: "Withdraw interest" }),
  ).toBeVisible();
});
