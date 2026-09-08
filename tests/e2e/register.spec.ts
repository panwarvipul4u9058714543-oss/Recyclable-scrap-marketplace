import { test, expect } from "@playwright/test";

// A unique phone per run keeps the test independent of existing rows.
function uniquePhone() {
  const suffix = Date.now().toString().slice(-9).padStart(9, "0");
  return `+1${suffix}`;
}

test("a new user registers, verifies their phone and picks multiple roles", async ({
  page,
}) => {
  const phone = uniquePhone();

  await page.goto("/register");

  // Step 1: request a code.
  await page.getByLabel("Phone number").fill(phone);
  await page.getByRole("button", { name: "Send code" }).click();

  // In dev mode the mocked code is shown on screen; read it and submit.
  const devCode = page.locator("strong").first();
  await expect(devCode).toHaveText(/^\d{6}$/);
  const code = (await devCode.textContent())!.trim();

  await page.getByLabel("Verification code").fill(code);
  await page.getByRole("button", { name: "Verify" }).click();

  // Step 3: pick multiple roles (household + business).
  await expect(
    page.getByText("How will you use the marketplace?"),
  ).toBeVisible();
  await page.getByLabel("Household").check();
  await page.getByLabel("Business").check();
  await page.getByRole("button", { name: "Continue" }).click();

  // Lands on the dashboard with both roles reflected.
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Your dashboard" })).toBeVisible();
  await expect(page.getByText(phone)).toBeVisible();
  await expect(page.getByText("Household", { exact: false })).toBeVisible();
  await expect(page.getByText("Business", { exact: false })).toBeVisible();
});

test("an unverified visitor is redirected from the dashboard to register", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/register$/);
});
