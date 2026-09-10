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

test("a collector edits their profile and it appears on the public page", async ({
  page,
}) => {
  const phone = await register(page, ["Collector (Kabadiwala)"], 100);

  await page.getByRole("link", { name: "Edit your profile" }).click();
  await expect(page).toHaveURL(/\/profile$/);

  await page.getByLabel("Display name").fill("Ravi K.");
  await page
    .getByLabel("About you (optional)")
    .fill("Collect PET and paper twice a week.");
  await page.getByLabel("Service area").fill("Bengaluru south");
  await page.getByLabel("How far you'll travel (km)").fill("8");
  await page.getByLabel("Plastic (bottles, containers, packaging)").check();
  await page.getByLabel("Paper (newspaper, books, office paper)").check();

  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status")).toHaveText("Profile saved.");

  // Navigate to the public profile shown at /u/[id].
  const link = page.getByRole("link", { name: /\/u\// });
  await link.click();

  await expect(page.getByRole("heading", { name: "Ravi K." })).toBeVisible();
  await expect(page.locator("body")).toContainText("Bengaluru south");
  await expect(page.locator("body")).toContainText("up to 8 km");
  await expect(page.locator("body")).toContainText("Plastic");
  await expect(page.locator("body")).toContainText("Paper");

  // Phone number must never appear on the public profile.
  await expect(page.locator("body")).not.toContainText(phone);
});
