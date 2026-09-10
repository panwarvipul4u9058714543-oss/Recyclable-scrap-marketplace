import { test, expect } from "@playwright/test";

test("home page renders the marketplace title", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Recyclable Scrap Marketplace" }),
  ).toBeVisible();
});
