import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";
import pg from "pg";

const database = process.env.TEST_DATABASE_URL;
const origin = "http://127.0.0.1:3100";
test.skip(!database || !process.env.PUBLIC_AUTH_SECRET, "Requires a migrated local test database and public identity configuration.");

async function capturedLink(email: string, kind: "verify" | "reset") {
  const result = await promisify(execFile)(process.execPath, ["--conditions=react-server", "tests/helpers/read-identity-test-link.ts", email, kind]);
  return result.stdout;
}

test("registration, verification, account changes, recovery and public/staff isolation", async ({ page, context, request }, info) => {
  if (!database || !["127.0.0.1", "localhost"].includes(new URL(database).hostname)) throw new Error("Use a dedicated local database.");
  const db = new pg.Client({ connectionString: database });
  const email = `${randomUUID()}@example.test`;
  const password = `First Password ${randomUUID()}`;
  const resetPassword = `Recovery Password ${randomUUID()}`;
  const headers = { Origin: origin };
  const theme = info.project.name === "mobile" ? "light" : "dark";
  await db.connect();
  try {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/account");
    await expect(page).toHaveURL("/login");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    const nav = page.getByRole("navigation", { name: "Account navigation" });
    await nav.getByRole("link", { name: "Create account" }).click();
    await page.getByLabel("Full name").fill("Browser Identity Fixture");
    await page.getByLabel("Email address").fill(email.toUpperCase());
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByLabel("Confirm password", { exact: true }).fill(password);
    const showPassword = page.getByRole("button", { name: "Show password", exact: true });
    await expect(showPassword).toHaveCSS("white-space", "nowrap");
    await showPassword.click();
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Hide password", exact: true }).click();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    await expect(page.locator(".identity-form").getByRole("status")).toContainText("queued");

    const data = { name: "Different Name", email, password, confirmation: password, website: "", consent: true };
    const register = (patch = {}) => request.post("/api/identity/register", { headers, data: { ...data, ...patch } });
    expect((await register({ role: "administrator" })).status()).toBe(400);
    expect((await register({ consent: false })).status()).toBe(400);
    const duplicate = await register();
    expect(duplicate.status()).toBe(202);
    expect(await duplicate.json()).toEqual({ ok: true });
    const account = await db.query('SELECT id,name,email,"consentVersion","emailVerified" FROM palonex_private.identity_user WHERE email=$1', [email]);
    expect(account.rows).toHaveLength(1);
    expect(account.rows[0]).toMatchObject({ name: "Browser Identity Fixture", email, emailVerified: false });

    const login = async (value: string) => {
      await page.getByLabel("Email address").fill(email);
      await page.getByLabel("Password", { exact: true }).fill(value);
      await page.getByRole("button", { name: "Log in", exact: true }).click();
    };
    await page.goto("/login?next=https://elsewhere.example.test");
    await login(password);
    await expect(page.locator(".identity-form").getByRole("alert")).toContainText("Verify your email");
    await page.getByRole("link", { name: "Resend verification" }).click();
    const resend = page.getByRole("button", { name: "Request verification link" });
    await expect(resend).toBeEnabled();
    await page.getByLabel("Email address").fill(email);
    await resend.click();
    await expect(page.locator(".identity-form").getByRole("status")).toContainText("queued");
    const verify = await capturedLink(email, "verify");
    await page.goto(verify);
    await page.getByRole("button", { name: "Verify email", exact: true }).click();
    await expect(page.getByText("Your email is verified. You can now log in.")).toBeVisible();
    expect((await request.post("/api/identity/verify", { headers, data: { link: new URL(verify).hash.slice(1) } })).status()).toBe(400);

    expect((await register()).status()).toBe(202);
    expect((await register()).status()).toBe(429);
    await page.goto("/login?next=https://elsewhere.example.test");
    await login("wrong passphrase");
    await expect(page.locator(".identity-form").getByRole("alert")).toHaveText("Invalid email or password.");
    await login(password);
    await expect(page).toHaveURL("/account");
    await expect(nav.getByRole("link", { name: "Account", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your account" })).toBeVisible();
    await expect(page.getByText(/Verified email/)).toBeVisible();
    expect((await page.request.get("/account")).headers()["cache-control"]).toContain("no-store");
    await page.reload();
    await expect(page).toHaveURL("/account");
    await page.getByLabel("Full name").fill("Edited Identity Fixture");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Your profile has been updated.")).toBeVisible();
    expect((await page.request.post("/api/identity/profile", { headers, data: { name: "Forged", userId: randomUUID() } })).status()).toBe(400);
    expect((await page.request.post("/api/identity/profile", { headers: { Origin: "https://elsewhere.example.test" }, data: { name: "Forged" } })).status()).toBe(403);
    await page.reload();
    await expect(page.getByLabel("Full name")).toHaveValue("Edited Identity Fixture");
    await page.goto("/admin/accounts");
    await expect(page).toHaveURL("/admin/login");
    expect((await page.request.post("/api/admin/accounts", { headers, data: { action: "list", search: "", page: 1 } })).status()).toBe(401);

    const stored = (await context.cookies()).find(cookie => cookie.name.endsWith("palonex-public.session_token"))!;
    expect(stored.httpOnly).toBe(true);
    const unknown = await request.post("/api/identity/forgot", { headers, data: { email: `${randomUUID()}@example.test` } });
    expect(unknown.status()).toBe(202);
    expect(await unknown.json()).toEqual({ ok: true });
    await page.goto("/forgot-password");
    await page.getByLabel("Email address").fill(email);
    await page.getByRole("button", { name: "Request reset link" }).click();
    await expect(page.locator(".identity-form").getByRole("status")).toContainText("queued");
    const reset = await capturedLink(email, "reset");
    await page.goto(reset);
    await page.getByLabel("Password", { exact: true }).fill(resetPassword);
    await page.getByLabel("Confirm password", { exact: true }).fill(resetPassword);
    await page.getByRole("button", { name: "Reset password", exact: true }).click();
    await expect(page.getByText("Password reset. Log in with your new password.")).toBeVisible();
    const old = await request.get("/api/identity/session", { headers: { Cookie: `${stored.name}=${stored.value}` } });
    expect(await old.json()).toEqual({ authenticated: false });
    await page.goto("/login");
    await login(resetPassword);
    await expect(page).toHaveURL("/account");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
    await page.getByLabel("Current password", { exact: true }).fill(resetPassword);
    const changedPassword = `Changed Password ${randomUUID()}`;
    await page.getByLabel("Password", { exact: true }).fill(changedPassword);
    await page.getByLabel("Confirm password", { exact: true }).fill(changedPassword);
    await page.getByRole("button", { name: "Change password", exact: true }).click();
    await expect(page.getByText("Password changed. Other sessions have been revoked.")).toBeVisible();
    await page.getByRole("button", { name: "Log out of this account" }).click();
    await expect(page).toHaveURL("/login");
    await page.goto("/account");
    await expect(page).toHaveURL("/login");
    expect((await request.post("/api/identity/profile", { headers, data: { name: "Forged" } })).status()).toBe(401);
  } finally {
    await db.query("DELETE FROM palonex_private.identity_user WHERE email=$1", [email]);
    await db.end();
  }
});
