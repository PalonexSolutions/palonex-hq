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

test("first visit follows the OS and theme changes persist across routes and reloads", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const root = page.locator("html");
  const toggle = page.getByRole("button", { name: "Light theme" });
  await expect(root).toHaveAttribute("data-theme", "light");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");

  await toggle.focus();
  await page.keyboard.press("Space");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(root).toHaveAttribute("data-theme", "dark");

  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Products" }).click();
  await expect(page).toHaveURL("/products");
  await page.reload();
  await expect(root).toHaveAttribute("data-theme", "dark");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  expect(errors).toEqual([]);
});

test("saved theme is applied before external hydration scripts run", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => localStorage.setItem("palonex-theme", "light"));
  await page.route("**/_next/static/**/*.js", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).toHaveCSS("color-scheme", "light");
});

for (const theme of ["dark", "light"] as const) {
  test(`each public page and its brand artwork renders in ${theme} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    const paths = ["/", "/about", "/products", "/labs", "/opportunities",
      ...productPages.map(([, slug]) => `/products/${slug}`)];

    for (const path of paths) {
      expect((await page.goto(path))?.ok(), path).toBe(true);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

      const artwork = [
        [page.getByRole("link", { name: "PaLoNex home" }).locator("img"), 806, 993] as const,
        [page.getByRole("img", { name: "PaLoNex — Tools that think. Steps that work." }), 602, 227] as const,
      ];
      for (const [image, width, height] of artwork) {
        await image.scrollIntoViewIfNeeded();
        await image.evaluate((element: HTMLImageElement) => element.decode());
        const dimensions = await image.evaluate((element: HTMLImageElement) => ({
          width: element.naturalWidth,
          height: element.naturalHeight,
          ratio: element.getBoundingClientRect().width / element.getBoundingClientRect().height,
        }));
        expect(dimensions.width).toBe(width);
        expect(dimensions.height).toBe(height);
        expect(dimensions.ratio).toBeCloseTo(width / height, 2);
      }
    }
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", "/brand/palonex-logo.png");
  });
}
