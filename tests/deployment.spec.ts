import { expect, test } from "@playwright/test";

test("public pages and private endpoints return their security headers", async ({ request }) => {
  const home = await request.get("/");
  expect(home.ok()).toBe(true);
  expect(home.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(home.headers()["content-security-policy"]).toContain("form-action 'self'");
  expect(home.headers()["x-content-type-options"]).toBe("nosniff");
  expect(home.headers()["permissions-policy"]).toContain("camera=()");
  expect(home.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(home.headers()["x-powered-by"]).toBeUndefined();
  for (const path of ["/admin/login", "/login", "/reset-password", "/api/identity/session", "/api/health/database"]) {
    const result = await request.get(path);
    expect(result.headers()["cache-control"]).toContain("no-store");
    expect(result.headers()["referrer-policy"]).toBe("no-referrer");
    expect(result.headers()["x-robots-tag"]).toContain("noindex");
  }
});

test("both scheduled routes refuse anonymous and invalid requests and pause before delivery", async ({ request }) => {
  for (const path of ["/api/internal/notifications", "/api/internal/identity-mail"]) {
    const denied = await request.get(path);
    expect(denied.status()).toBe(401);
    expect(await denied.json()).toEqual({ error: "Unauthorized." });
    expect(denied.headers()["cache-control"]).toContain("no-store");
    const forged = await request.get(path, { headers: { authorization: "Bearer incorrect" } });
    expect(forged.status()).toBe(401);
    const secret = process.env.CRON_SECRET;
    if (secret && process.env.MAIL_WORKERS_ENABLED !== "true") {
      const paused = await request.get(path, { headers: { authorization: `Bearer ${secret}` } });
      expect(paused.status()).toBe(200);
      expect(await paused.json()).toEqual({ status: "paused" });
    }
  }
});
