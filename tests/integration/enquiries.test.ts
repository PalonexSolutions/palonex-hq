import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { enquirySchema } from "../../features/enquiries/schema.ts";
import { getDatabase, transaction } from "../../lib/server/database.ts";
import { getEnquiry, listEnquiries, saveEnquiry, transitionEnquiry } from "../../lib/server/enquiries.ts";
import { deliverNotifications, type Email } from "../../lib/server/notifications.ts";

const url = process.env.TEST_DATABASE_URL;
if (!url || !["localhost", "127.0.0.1"].includes(new URL(url).hostname)) {
  throw new Error("Provide TEST_DATABASE_URL for a dedicated local database.");
}
process.env.DATABASE_URL = url;
process.env.ENQUIRY_SIGNING_SECRET = randomUUID().repeat(2);
const db = getDatabase();
const marker = randomUUID();
const created: string[] = [];
const input = enquirySchema.parse({
  fullName: "Test <PaLoNex>", email: `${marker}@example.test`, organization: "",
  category: "general", subject: `Integration ${marker}`, message: "Test enquiry from the test suite.",
  consent: true, website: "", token: "unit-test",
});

after(async () => {
  try {
    await db.query("DELETE FROM palonex_private.enquiries WHERE id=ANY($1::uuid[])", [created]);
    await db.query("DELETE FROM palonex_private.enquiry_rate_limits WHERE key=$1", [marker]);
  } finally { await db.end(); }
});

test("database migrations, persistence, idempotency, concurrency and rate limits", async () => {
  const { rows } = await db.query("SELECT name FROM palonex_private.schema_migrations WHERE name='001_enquiries.sql'");
  assert.equal(rows.length, 1);
  const token = randomUUID();
  const rate = [{ key: marker, limit: 2 }];
  const results = await Promise.all([saveEnquiry(token, input, rate), saveEnquiry(token, input, rate)]);
  const first = results[0].id;
  created.push(first);
  assert.equal(results[1].id, first);
  assert.equal(results.filter(result => result.duplicate).length, 1);
  const stored = await getEnquiry(first);
  assert.equal(stored?.message, input.message);
  assert.equal(stored?.email, input.email);
  assert.equal(stored?.organization, null);
  assert.ok(stored?.consented_at instanceof Date);
  assert.ok(stored?.privacy_version);
  await assert.rejects(saveEnquiry(token, { ...input, subject: "Changed subject" }, rate), { status: 409 });
  const second = await saveEnquiry(randomUUID(), input, rate);
  created.push(second.id);
  await assert.rejects(saveEnquiry(randomUUID(), input, rate), { status: 429 });
  assert.equal((await db.query("SELECT count(*)::int AS count FROM palonex_private.enquiry_notifications WHERE enquiry_id=$1", [first])).rows[0].count, 2);
  assert.equal((await db.query("SELECT hits FROM palonex_private.enquiry_rate_limits WHERE key=$1", [marker])).rows[0].hits, 2);
});

test("server-only listing uses keyset pagination, scoped filtering and controlled transitions", async () => {
  const firstPage = await listEnquiries({ search: marker, category: "general", status: "NEW", limit: 1 });
  assert.equal(firstPage.items.length, 1);
  assert.ok(firstPage.nextCursor);
  const next = await listEnquiries({ search: marker, category: "general", status: "NEW", cursor: firstPage.nextCursor, limit: 1 });
  assert.equal(next.items.length, 1);
  assert.notEqual(firstPage.items[0].id, next.items[0].id);
  assert.equal(next.nextCursor, null);
  const id = firstPage.items[0].id;
  await assert.rejects(transitionEnquiry(id, "NEW", "RESOLVED"), { status: 409 });
  await transitionEnquiry(id, "NEW", "IN_PROGRESS");
  await assert.rejects(transitionEnquiry(id, "NEW", "IN_PROGRESS"), { status: 409 });
  await transitionEnquiry(id, "IN_PROGRESS", "RESOLVED");
  const filtered = await listEnquiries({ search: marker, status: "RESOLVED" });
  assert.deepEqual(filtered.items.map(item => item.id), [id]);
  assert.ok(filtered.items[0].status_changed_at.getTime() >= filtered.items[0].created_at.getTime());
});

test("outbox handles provider failures, resumes safely and keeps enquiry messages private", async () => {
  const sent: { email: Email; key: string }[] = [];
  const sender = { from: "sender@example.test", companyTo: "company@example.test" };
  const provider = {
    async send(email: Email, key: string) {
      assert.match(email.text, /PaLoNex/);
      assert.ok(!email.text.includes(input.message));
      assert.ok(!email.html.includes("<PaLoNex>"));
      if (key.endsWith("acknowledgement")) throw new Error("Mock provider failure");
      sent.push({ email, key });
    },
  };
  // This suite uses a dedicated, fresh database and runs before browser submissions.
  const first = await deliverNotifications(provider, sender);
  assert.deepEqual(first, { sent: 2, failed: 2 });
  assert.equal((await getEnquiry(created[0]))?.message, input.message);
  assert.equal((await db.query("SELECT attempts FROM palonex_private.enquiry_notifications WHERE enquiry_id=$1 AND kind='acknowledgement'", [created[0]])).rows[0].attempts, 1);
  await db.query("UPDATE palonex_private.enquiry_notifications SET available_at=now() WHERE enquiry_id=ANY($1::uuid[]) AND sent_at IS NULL", [created]);
  const second = await deliverNotifications({ async send(email, key) { sent.push({ email, key }); } }, sender);
  assert.deepEqual(second, { sent: 2, failed: 0 });
  assert.equal(new Set(sent.map(delivery => delivery.key)).size, 4);
  assert.equal(sent.filter(delivery => delivery.email.to === input.email).length, 2);
  assert.deepEqual(await deliverNotifications(provider, sender), { sent: 0, failed: 0 });
});

test("database failures roll back writes and release the connection", async () => {
  const key = randomUUID();
  await assert.rejects(transaction(async client => {
    await client.query("INSERT INTO palonex_private.enquiry_rate_limits VALUES ($1, now(), 1)", [key]);
    await client.query("SELECT * FROM missing_enquiry_test_table");
  }));
  assert.equal((await db.query("SELECT key FROM palonex_private.enquiry_rate_limits WHERE key=$1", [key])).rowCount, 0);
  assert.equal((await db.query("SELECT 1 AS connected")).rows[0].connected, 1);
});
