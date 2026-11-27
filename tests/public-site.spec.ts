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

const productPages = [
  ["FoodSnap", "foodsnap"],
  ["Rentify", "rentify"],
  ["MediAssist", "mediassist"],
  ["SkillEdge", "skilledge"],
  ["VisionCare", "visioncare"],
  ["EventEase", "eventease"],
  ["TalkSign", "talksign"],
] as const;

for (const [index, [name, slug]] of productPages.entries()) {
  test(`${name} is discoverable and has a complete concept page`, async ({ page }) => {
    await page.goto("/products");
    await page.getByRole("link", { name: `Explore ${name}`, exact: true }).click();
    await expect(page).toHaveURL(`/products/${slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
    await expect(page.getByText("Concept", { exact: true })).toBeVisible();

    for (const heading of ["The problem", "The proposed solution", "Who it’s for",
      "Proposed capabilities", "Example use cases", "Future development"]) {
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    }

    await expect(page).toHaveTitle(`${name} AI concept | PaLoNex`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://palonexsolutions.in/products/${slug}`);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /^A concept for .+/);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", `${name} AI concept`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      await page.evaluate(() => innerWidth),
    );
    const [nextName, nextSlug] = productPages[(index + 1) % productPages.length];
    await page.getByRole("link", { name: `Next concept: ${nextName}` }).click();
    await expect(page).toHaveURL(`/products/${nextSlug}`);
    await page.getByRole("link", { name: "Explore the portfolio" }).click();
    await expect(page).toHaveURL("/products");
  });
}

test("sitemap lists the catalog and seven product concepts", async ({ request }) => {
  const response = await request.get("/sitemap.xml");
  expect(response.ok()).toBe(true);
  const sitemap = await response.text();
  for (const [, slug] of productPages) {
    expect(sitemap).toContain(`https://palonexsolutions.in/products/${slug}</loc>`);
  }
});

test("an unknown product returns 404", async ({ request }) => {
  const response = await request.get("/products/unknown-concept");
  expect(response.status()).toBe(404);
});
