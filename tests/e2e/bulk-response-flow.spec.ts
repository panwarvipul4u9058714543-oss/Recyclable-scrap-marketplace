import { test, expect, type Page } from "@playwright/test";

function uniquePhone(seed: number) {
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

async function register(page: Page, roles: string[], seed: number) {
  const phone = uniquePhone(seed);
  await verify(page, phone);
  for (const role of roles) await page.getByLabel(role).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  return phone;
}

async function signInAgain(page: Page, phone: string) {
  await verify(page, phone);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function logout(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
}

test("supplier responds → buyer selects → mutual reveal → completed", async ({
  page,
}) => {
  // 1) Dealer publishes a bulk requirement.
  const dealerPhone = await register(page, ["Scrap Dealer"], 950);
  await page.getByRole("link", { name: "Publish a bulk requirement" }).click();
  await page.getByLabel("Material").selectOption("PLASTIC");
  await page.getByLabel("At least", { exact: true }).fill("500");
  await page.getByLabel("Region (service area)").fill("Bengaluru South");
  await page.getByRole("button", { name: "Publish requirement" }).click();

  const mine = page.getByRole("region", { name: "Your bulk requirements" });
  await expect(mine).toContainText(
    "Plastic (bottles, containers, packaging)",
  );
  await page.goto("/dashboard");
  await logout(page);

  // 2) Supplier signs up, browses, opens the requirement, responds.
  const supplierPhone = await register(page, ["Collector (Kabadiwala)"], 951);
  await page.getByRole("link", { name: "Browse bulk requirements" }).click();
  await page
    .getByRole("link", { name: "Open requirement → respond" })
    .first()
    .click();

  await page.getByLabel("Quantity").fill("600");
  await page
    .getByLabel("Notes (optional)")
    .fill("Weekly deliveries possible.");
  await page.getByRole("button", { name: "Submit response" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Response submitted" }),
  ).toBeVisible();

  await page.goto("/dashboard");
  await logout(page);

  // 3) Dealer signs back in, sees the response, selects it, reveals.
  await signInAgain(page, dealerPhone);
  await page.getByRole("link", { name: "Publish a bulk requirement" }).click();
  // Open the requirement.
  await page
    .getByRole("region", { name: "Your bulk requirements" })
    .getByRole("listitem")
    .first();

  // The buyer's requirement list uses BulkRequirementList without a link, so
  // navigate directly via the requirement URL: fetch the id from the seller's
  // API instead.
  const listRes = await page.request.get(
    "/api/bulk-requirements?scope=mine",
  );
  const listBody = (await listRes.json()) as {
    requirements: { id: string }[];
  };
  const reqId = listBody.requirements[0]!.id;
  await page.goto(`/bulk/${reqId}`);

  const responses = page.getByRole("region", { name: "Responses" });
  await expect(responses).toContainText("Offers 600 kg");
  await expect(responses).toContainText("PENDING");
  await responses
    .getByRole("button", { name: "Select this supplier" })
    .click();
  await expect(responses).toContainText("SELECTED");

  // Open the match and reveal.
  await responses.getByRole("link", { name: "Open response" }).click();
  await expect(page).toHaveURL(/\/bulk\/responses\//);
  const contact = page.getByRole("region", { name: "Contact" });
  await expect(contact).toContainText("hidden until both parties reveal");
  await page.getByRole("button", { name: "Reveal my contact" }).click();
  await expect(contact).toContainText("You:");

  await page.goto("/dashboard");
  await logout(page);

  // 4) Supplier signs back in, opens the match, reveals, chats and marks complete.
  await signInAgain(page, supplierPhone);
  await page.goto("/bulk");
  const myResponses = page.getByRole("region", { name: "Your bulk responses" });
  await expect(myResponses).toContainText("SELECTED");
  await myResponses.getByRole("link", { name: "Open match" }).click();
  await expect(page).toHaveURL(/\/bulk\/responses\//);

  await page.getByRole("button", { name: "Reveal my contact" }).click();
  const revealedContact = page.getByRole("region", { name: "Contact" });
  await expect(revealedContact).toContainText(dealerPhone);

  await page.getByLabel("Message").fill("On my way.");
  await page.getByRole("button", { name: "Send" }).click();

  await page.getByRole("button", { name: "Mark as completed" }).click();
  await page.getByLabel("Actual quantity (optional)").fill("550");
  await page.getByLabel("Final price (optional)").fill("27500");
  await page.getByRole("button", { name: "Confirm completed" }).click();

  await expect(
    page.getByRole("region", { name: "Status" }),
  ).toContainText("COMPLETED");
});
