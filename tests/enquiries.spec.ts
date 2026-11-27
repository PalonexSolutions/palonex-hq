import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import pg from "pg";

const database = process.env.TEST_DATABASE_URL;
test.skip(!database, "Requires a migrated local TEST_DATABASE_URL.");

const origin = "http://127.0.0.1:3100";

async function deleteFixtures(email: string) {
  if (!database || !["localhost", "127.0.0.1"].includes(new URL(database).hostname)) {
    throw new Error("Enquiry browser tests require a dedicated local database.");
  }
  const client = new pg.Client({ connectionString: database });
  await client.connect();
  try { await client.query("DELETE FROM palonex_private.enquiries WHERE email=$1", [email]); }
  finally { await client.end(); }
}

test("the public form persists an enquiry and shows its reference", async ({ page }) => {
  const email = `${randomUUID()}@example.test`;
  try {
    await page.goto("/#contact");
    await page.getByLabel("Full name").fill("Test Visitor");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Company or organization (optional)").fill("Test Company");
    await page.getByLabel("Enquiry category").selectOption("partnership");
    await page.getByLabel("Subject").fill("Integration enquiry");
    await page.getByLabel("Message", { exact: true }).fill("This enquiry is a test fixture.");
    const consent = page.getByRole("checkbox", { name: /I consent/ });
    await expect(consent).not.toBeChecked();
    await expect(page.getByRole("link", { name: "privacy policy", exact: true })).toHaveAttribute("href", "/privacy");
    await consent.check();
    await page.getByRole("button", { name: "Send enquiry" }).click();
    const success = page.getByRole("status").filter({ hasText: "Your enquiry has been received" });
    await expect(success).toBeVisible({ timeout: 15_000 });
    const id = await success.locator("strong").textContent();
    const client = new pg.Client({ connectionString: database });
    await client.connect();
    try {
      const { rows } = await client.query("SELECT email, category, status, consented_at FROM palonex_private.enquiries WHERE id=$1", [id]);
      expect(rows[0]).toMatchObject({ email, category: "partnership", status: "NEW", consented_at: expect.any(Date) });
    } finally { await client.end(); }
    await page.getByRole("button", { name: "Send another enquiry" }).click();
    await expect(page.getByLabel("Email address")).toHaveValue("");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  } finally { await deleteFixtures(email); }
});

test("HTTP contract rejects abuse and deduplicates persistent submissions", async ({ request }) => {
  const email = `${randomUUID()}@example.test`;
  try {
    expect((await request.get("/api/health/database")).status()).toBe(200);
    expect((await request.get("/api/internal/notifications")).status()).toBe(401);
    const tokens = await Promise.all(Array.from({ length: 4 }, async () => {
      const response = await request.get("/api/enquiries");
      expect(response.ok()).toBe(true);
      expect(response.headers()["cache-control"]).toBe("no-store");
      const body = await response.json();
      expect(Object.keys(body).sort()).toEqual(["minimumWaitMs", "token"]);
      return body as { token: string; minimumWaitMs: number };
    }));
    const data = { fullName: "Test Visitor", email, organization: "", category: "general", subject: "HTTP smoke test",
      message: "This is isolated test data.", consent: true, website: "", token: tokens[0].token };
    const post = (patch: object, header = origin) => request.post("/api/enquiries", { data: { ...data, ...patch }, headers: { Origin: header } });
    expect((await post({}, "https://other.example.test")).status()).toBe(403);
    expect((await post({ website: "bot-filled" })).status()).toBe(400);
    const validation = await post({ email: "invalid", consent: false });
    expect(validation.status()).toBe(422);
    expect((await validation.json()).fields).toHaveProperty("consent");
    expect((await post({ message: "x".repeat(37_000) })).status()).toBe(413);
    const immediate = await post({});
    expect(immediate.status()).toBe(429);
    expect(immediate.headers()["retry-after"]).toBe("3");
    await new Promise(resolve => setTimeout(resolve, tokens[0].minimumWaitMs + 100));
    const result = await post({});
    expect(result.status()).toBe(201);
    const body = await result.json();
    expect(Object.keys(body)).toEqual(["id"]);
    const retry = await post({});
    expect(retry.status()).toBe(200);
    expect(await retry.json()).toEqual(body);
    expect((await post({ subject: "Different values" })).status()).toBe(409);
    expect((await post({ token: tokens[1].token })).status()).toBe(201);
    expect((await post({ token: tokens[2].token })).status()).toBe(201);
    expect((await post({ token: tokens[3].token })).status()).toBe(429);
  } finally { await deleteFixtures(email); }
});
