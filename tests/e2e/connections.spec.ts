import { test, expect, type Page } from "@playwright/test";

// A unique phone per run keeps the test independent of existing rows.
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

// Re-verify an already-registered phone. The role step preloads existing
// roles, so we just click Continue to land back on the dashboard.
async function signBackIn(page: Page, phone: string) {
  await page.goto("/register");
  await page.getByLabel("Phone number").fill(phone);
  await page.getByRole("button", { name: "Send code" }).click();
  const devCode = page.locator("strong").first();
  await expect(devCode).toHaveText(/^\d{6}$/);
  const code = (await devCode.textContent())!.trim();
  await page.getByLabel("Verification code").fill(code);
  await page.getByRole("button", { name: "Verify" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function createListing(page: Page, title: string) {
  await page.getByRole("link", { name: "Manage your listings" }).click();
  await page.getByRole("link", { name: "+ New listing" }).click();

  await page.getByLabel("Material category").selectOption("PLASTIC");
  await page.getByLabel("Title").fill(title);
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
}

test("interest → selection → chat → mutual reveal → cancel", async ({
  page,
}) => {
  // 1) Seller registers and posts a listing.
  const sellerPhone = await register(page, ["Household"], 20);
  await createListing(page, "Old newspapers");

  // 2) Seller signs out; collector registers and expresses interest.
  await page.goto("/dashboard");
  await logout(page);
  const collectorPhone = await register(page, ["Collector (Kabadiwala)"], 21);
  await page.getByRole("link", { name: "Browse nearby listings" }).click();
  await page.getByLabel("Latitude").fill("12.9352");
  await page.getByLabel("Longitude").fill("77.6245");
  await page.getByRole("button", { name: "Show nearby listings" }).click();
  const results = page.getByRole("region", { name: "Search results" });
  await expect(results).toContainText("Old newspapers");
  await results
    .getByRole("button", { name: "I'm interested" })
    .first()
    .click();

  // 3) Seller signs back in and selects the interested buyer.
  await page.goto("/dashboard");
  await logout(page);
  await signBackIn(page, sellerPhone);
  await page.getByRole("link", { name: "Manage your listings" }).click();
  const card = page.locator("li", { hasText: "Old newspapers" });
  await expect(card.getByText("Interested buyers")).toBeVisible();
  await card.getByRole("button", { name: "Select" }).click();
  await expect(card.getByText(/Reserved for/i)).toBeVisible();

  // 4) Seller opens the connection detail, posts a message and reveals
  //    their contact.
  await page.goto("/connections");
  await page
    .getByRole("region", { name: "As a seller" })
    .getByRole("link", { name: "Old newspapers" })
    .click();
  await expect(page.getByRole("heading", { name: "Old newspapers" })).toBeVisible();
  const contact = page.getByRole("region", { name: "Contact" });
  await expect(contact).toContainText(
    "Exact contact details are hidden until both of you reveal.",
  );

  await page.getByLabel("Message").fill("Hi, when can you come by?");
  await page.getByRole("button", { name: "Send" }).click();
  const chat = page.getByRole("region", { name: "Chat" });
  await expect(chat).toContainText("Hi, when can you come by?");

  await contact.getByRole("button", { name: "Reveal my contact" }).click();
  await expect(contact).toContainText(/revealed/i);

  // 5) Collector signs in, sees the message, replies, and reveals — both
  //    contacts and pickup coordinates become visible.
  await page.goto("/dashboard");
  await logout(page);
  await signBackIn(page, collectorPhone);
  await page.getByRole("link", { name: "Your connections" }).click();
  await page
    .getByRole("region", { name: "As a buyer" })
    .getByRole("link", { name: "Old newspapers" })
    .click();

  await expect(chat).toContainText("Hi, when can you come by?");
  await page.getByLabel("Message").fill("Tomorrow at 10 works.");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(chat).toContainText("Tomorrow at 10 works.");

  await contact.getByRole("button", { name: "Reveal my contact" }).click();
  // Once both reveal, the seller's phone appears as a tel: link and the
  // pickup coordinates are visible to the buyer.
  await expect(contact.getByRole("link", { name: sellerPhone })).toBeVisible();
  await expect(contact).toContainText(/Pickup coordinates:/i);

  // 6) The buyer cancels the reservation; posting new messages is now
  //    blocked and the listing reappears on /nearby.
  page.on("dialog", (d) => d.accept());
  await page
    .getByRole("region", { name: "Reservation" })
    .getByRole("button", { name: "Cancel reservation" })
    .click();
  await expect(
    page.getByRole("region", { name: "Reservation" }),
  ).toContainText("CANCELLED");
  await expect(chat).toContainText(/no new messages can be sent/i);

  await page.goto("/nearby");
  await page.getByLabel("Latitude").fill("12.9352");
  await page.getByLabel("Longitude").fill("77.6245");
  await page.getByRole("button", { name: "Show nearby listings" }).click();
  await expect(
    page.getByRole("region", { name: "Search results" }),
  ).toContainText("Old newspapers");
});
