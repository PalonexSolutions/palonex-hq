import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { expect, test } from "@playwright/test";
import pg from "pg";

const database = process.env.TEST_DATABASE_URL;
const origin = "http://127.0.0.1:3100";
test.skip(!database || !process.env.BETTER_AUTH_SECRET, "Requires migrated local TEST_DATABASE_URL and BETTER_AUTH_SECRET.");

test("direct page visits and admin API requests require a valid session", async ({ page, request }) => {
  const id = randomUUID();
  for (const path of ["/admin", "/admin/enquiries", `/admin/enquiries/${id}`, "/admin/notifications"]) {
    await page.goto(path);
    await expect(page).toHaveURL("/admin/login");
    await expect(page.getByRole("heading", { name: "Staff sign-in" })).toBeVisible();
  }
  const headers = { Origin: origin };
  expect((await request.post("/api/admin/enquiries", { headers, data: {} })).status()).toBe(401);
  expect((await request.patch(`/api/admin/enquiries/${id}`, { headers, data: { action: "note", note: "Test" } })).status()).toBe(401);
  expect((await request.delete("/api/admin/session", { headers })).status()).toBe(401);
  expect((await request.post("/api/auth/sign-up/email", { data: {} })).status()).toBe(404);
});

test("staff can sign in, review real enquiries, audit changes, monitor queue and sign out", async ({ page, context, request }, testInfo) => {
  if (!database || !["localhost", "127.0.0.1"].includes(new URL(database).hostname)) throw new Error("Use a dedicated local database.");
  const db = new pg.Client({ connectionString: database });
  const actor = randomUUID();
  const id = randomUUID();
  const staffEmail = `${actor}@example.test`;
  const enquiryEmail = `${id}@example.test`;
  const password = randomUUID();
  const subject = `Admin browser fixture ${id}`;
  const theme = testInfo.project.name === "mobile" ? "light" : "dark";
  await db.connect();

  try {
    await db.query('INSERT INTO palonex_private.admin_user (id,name,email,"emailVerified","createdAt","updatedAt") VALUES ($1,$2,$3,true,now(),now())',
      [actor, "Browser Staff Fixture", staffEmail]);
    await db.query('INSERT INTO palonex_private.admin_account (id,"accountId","providerId","userId",password,"createdAt","updatedAt") VALUES ($1,$2,\'credential\',$2,$3,now(),now())',
      [randomUUID(), actor, await hashPassword(password)]);
    await db.query("INSERT INTO palonex_private.admin_staff (user_id) VALUES ($1)", [actor]);
    await db.query(`
      INSERT INTO palonex_private.enquiries (id,submission_id,fingerprint,full_name,email,organization,category,subject,message,privacy_version)
      VALUES ($1,$2,'fixture','Test Visitor',$3,'Test Organization','product',$4,'Private browser text.','fixture')`,
    [id, randomUUID(), enquiryEmail, subject]);
    await db.query("INSERT INTO palonex_private.enquiry_notifications(enquiry_id,kind) VALUES ($1,'company')", [id]);

    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/admin/login");
    await page.getByLabel("Staff email").fill(staffEmail);
    await page.getByLabel("Password").fill("Invalid fixture password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.locator(".admin-form").getByRole("alert")).toHaveText("Invalid email or password.");
    await page.getByLabel("Password").fill(password);
    const login = page.waitForResponse(response => response.url().endsWith("/api/admin/session") && response.request().method() === "POST");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    const response = await login;
    expect(response.status()).toBe(200);
    await expect(page).toHaveURL("/admin");
    await expect(page.getByRole("heading", { name: "Enquiry overview" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    const cookie = (await context.cookies()).find(cookie => cookie.name.endsWith("session_token"))!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe("Strict");
    expect(await page.evaluate(() => document.cookie)).not.toContain(cookie.name);

    const privatePage = await context.request.get("/admin");
    expect(privatePage.headers()["cache-control"]).toContain("no-store");
    expect(privatePage.headers()["referrer-policy"]).toBe("no-referrer");
    const api = `/api/admin/enquiries/${id}`;
    expect((await context.request.patch(api, { headers: { Origin: "https://elsewhere.example.test" }, data: { action: "note", note: "Blocked" } })).status()).toBe(403);
    expect((await context.request.patch(api, { headers: { Origin: origin }, data: { action: "status", from: "NEW", to: "RESOLVED" } })).status()).toBe(409);
    expect((await context.request.patch(api, { headers: { Origin: origin }, data: { action: "note", note: "" } })).status()).toBe(400);
    expect((await context.request.delete(api, { headers: { Origin: origin } })).status()).toBe(405);

    const nav = page.getByRole("navigation", { name: "Admin navigation" });
    await nav.getByRole("link", { name: "Enquiries" }).click();
    await page.getByLabel("Search enquiries").fill(id);
    await page.getByRole("combobox", { name: "Status", exact: true }).selectOption("NEW");
    await page.getByRole("combobox", { name: "Category" }).selectOption("product");
    await page.getByRole("combobox", { name: "Sort by date" }).selectOption("oldest");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page.getByText("Page 1 · 1 results")).toBeVisible();
    await page.getByRole("link", { name: subject }).click();
    await expect(page.getByText("Private browser text.")).toBeVisible();
    await expect(page.getByText(/Policy fixture/)).toBeVisible();
    await page.getByRole("combobox", { name: "New status" }).selectOption("IN_PROGRESS");
    await page.getByRole("button", { name: "Review status change" }).click();
    await page.getByRole("button", { name: "Confirm status change" }).click();
    await expect(page.getByText("Status changed from NEW to IN_PROGRESS")).toBeVisible();
    await page.getByLabel("Internal note").fill("Private note fixture.");
    await page.getByRole("button", { name: "Add note" }).click();
    await expect(page.getByText("Private note fixture.", { exact: true })).toBeVisible();
    expect((await db.query("SELECT count(*)::int AS count FROM palonex_private.enquiry_audit WHERE enquiry_id=$1 AND actor_id=$2", [id, actor])).rows[0].count).toBe(2);

    await nav.getByRole("link", { name: "Notifications" }).click();
    await expect(page.getByRole("heading", { name: "Notifications", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: id })).toBeVisible();
    expect((await db.query("SELECT attempts,sent_at FROM palonex_private.enquiry_notifications WHERE enquiry_id=$1", [id])).rows[0]).toEqual({ attempts: 0, sent_at: null });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL("/admin/login");
    expect((await request.post("/api/admin/enquiries", {
      headers: { Origin: origin, Cookie: `${cookie.name}=${cookie.value}` }, data: {},
    })).status()).toBe(401);
  } finally {
    await db.query("DELETE FROM palonex_private.enquiries WHERE id=$1", [id]);
    await db.query("DELETE FROM palonex_private.admin_user WHERE id=$1", [actor]);
    await db.end();
  }
});
