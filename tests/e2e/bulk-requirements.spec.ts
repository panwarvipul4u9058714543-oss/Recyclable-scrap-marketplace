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

test("a dealer publishes a bulk requirement; a collector finds it on /bulk/browse", async ({
  page,
}) => {
  // 1) Dealer signs up and publishes a requirement.
  await register(page, ["Scrap Dealer"], 900);
  await page.getByRole("link", { name: "Publish a bulk requirement" }).click();
  await expect(page).toHaveURL(/\/bulk$/);

  await page.getByLabel("Material").selectOption("PLASTIC");
  await page.getByLabel("At least", { exact: true }).fill("500");
  await page
    .getByLabel("Region (service area)")
    .fill("Bengaluru South");
  await page
    .getByLabel("Quality notes (optional)")
    .fill("Clean, dry PET bottles preferred.");
  await page
    .getByRole("button", { name: "Publish requirement" })
    .click();

  const mine = page.getByRole("region", {
    name: "Your bulk requirements",
  });
  await expect(mine).toContainText(
    "Plastic (bottles, containers, packaging)",
  );
  await expect(mine).toContainText("At least 500 kg");
  await expect(mine).toContainText("Bengaluru South");

  await page.goto("/dashboard");
  await logout(page);

  // 2) A collector signs in and finds the requirement on /bulk/browse.
  await register(page, ["Collector (Kabadiwala)"], 901);
  await page.getByRole("link", { name: "Browse bulk requirements" }).click();
  await expect(page).toHaveURL(/\/bulk\/browse$/);

  const results = page.getByRole("region", { name: "Bulk requirements" });
  await expect(results).toContainText(
    "Plastic (bottles, containers, packaging)",
  );
  await expect(results).toContainText("Wants ≥ 500 kg");
  await expect(results).toContainText("Bengaluru South");
  await expect(results).toContainText("Scrap Dealer");

  // 3) Filtering by a non-matching material hides the requirement.
  await page.getByLabel("Material").selectOption("METAL");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(results).toContainText("No requirements match your filters.");
});
