import assert from "node:assert/strict";
import { test } from "node:test";
import { adminListSchema, enquiryChange, loginSchema } from "../../features/admin/schema.ts";

test("admin login and enquiry operations reject unexpected attributes and invalid input", () => {
  assert.equal(loginSchema.parse({ email: " Admin@Example.test ", password: "password" }).email, "admin@example.test");
  assert.equal(loginSchema.safeParse({ email: "admin@example.test", password: "x".repeat(129) }).success, false);
  assert.equal(adminListSchema.safeParse({ search: "x".repeat(151) }).success, false);
  assert.equal(adminListSchema.safeParse({ order: "NOW()" }).success, false);
  assert.equal(adminListSchema.safeParse({ cursor: { time: "29999", id: "not-a-uuid" } }).success, false);
  assert.equal(enquiryChange.safeParse({ action: "status", from: "NEW", to: "UNKNOWN" }).success, false);
  assert.equal(enquiryChange.safeParse({ action: "note", note: "  " }).success, false);
  assert.equal(enquiryChange.safeParse({ action: "note", note: "Private", actor: "forged" }).success, false);
});
