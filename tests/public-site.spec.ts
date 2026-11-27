import { expect, test } from "@playwright/test";

test("homepage introduces the company and links to the ecosystem", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBe(true);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Building with AI/);
  await page.getByRole("link", { name: "Explore the ecosystem" }).click();
  await expect(page).toHaveURL(/#ecosystem$/);
  await expect(page.getByRole("heading", { name: "Four ways to build with PaLoNex" })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => innerWidth),
  );
});

test("navigation opens the product catalog and each product is a concept", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Products" }).click();
  await expect(page).toHaveURL(/\/products$/);
  await expect(page.getByRole("heading", { name: "AI product concepts" })).toBeVisible();
  await expect(page.getByText("Concept", { exact: true })).toHaveCount(7);
  await page.getByRole("link", { name: "Get in touch" }).click();
  await expect(page).toHaveURL(/\/#contact$/);
  await expect(page.getByRole("heading", { name: "Business enquiries" })).toBeInViewport();
});
