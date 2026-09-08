import { test, expect, type Page } from "@playwright/test";

// A unique phone per run keeps the test independent of existing rows.
function uniquePhone() {
  const suffix = Date.now().toString().slice(-9).padStart(9, "0");
  return `+1${suffix}`;
}

// Register + verify a household account and land on the dashboard.
async function registerHousehold(page: Page) {
  await page.goto("/register");
  await page.getByLabel("Phone number").fill(uniquePhone());
  await page.getByRole("button", { name: "Send code" }).click();

  const devCode = page.locator("strong").first();
  await expect(devCode).toHaveText(/^\d{6}$/);
  const code = (await devCode.textContent())!.trim();

  await page.getByLabel("Verification code").fill(code);
  await page.getByRole("button", { name: "Verify" }).click();

  await page.getByLabel("Household").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("a household creates, pauses and closes a scrap listing", async ({
  page,
}) => {
  await registerHousehold(page);

  // Go to the listings screen and start a new listing.
  await page.getByRole("link", { name: "Manage your listings" }).click();
  await expect(page).toHaveURL(/\/listings$/);
  await page.getByRole("link", { name: "+ New listing" }).click();
  await expect(page).toHaveURL(/\/listings\/new$/);

  // The "ordinary recyclable scrap only" notice is always visible.
  await expect(
    page.getByText("List ordinary recyclable scrap only", { exact: false }),
  ).toBeVisible();

  // Fill the form. Choosing a material surfaces its safety warning.
  await page.getByLabel("Material category").selectOption("PLASTIC");
  await expect(page.getByRole("note")).toBeVisible();

  await page.getByLabel("Title").fill("Clean PET bottles, ~6 kg");
  await page
    .getByLabel("Photo URLs (one per line)")
    .fill("https://example.com/bottles.jpg");
  await page.getByLabel("From", { exact: true }).fill("5");
  await page.getByLabel("To", { exact: true }).fill("8");
  await page.getByLabel("Approximate locality").fill("Koramangala, Bengaluru");
  await page.getByRole("button", { name: "Publish listing" }).click();

  // Back on the listings screen the new ACTIVE listing shows.
  await expect(page).toHaveURL(/\/listings$/);
  const card = page.locator("li", { hasText: "Clean PET bottles" });
  await expect(card).toContainText("ACTIVE");

  // Pause it.
  await card.getByRole("button", { name: "Pause" }).click();
  await expect(card).toContainText("PAUSED");

  // Close it (confirm the dialog) — no more actions afterwards.
  page.once("dialog", (dialog) => dialog.accept());
  await card.getByRole("button", { name: "Close" }).click();
  await expect(card).toContainText("CLOSED");
});
