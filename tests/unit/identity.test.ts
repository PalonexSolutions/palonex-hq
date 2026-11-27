import assert from "node:assert/strict";
import { test } from "node:test";
import { forms, hasVerifiedAccess } from "../../features/identity/schema.ts";

const input = { name: " Fixture Person ", email: "STAFF@EXAMPLE.TEST", password: "Unique Passphrase 42!",
  confirmation: "Unique Passphrase 42!", website: "", consent: true };

test("registration validates consent, email, passwords and rejects caller-supplied authorization fields", () => {
  assert.equal(forms.register.parse(input).email, "staff@example.test");
  for (const patch of [{ role: "administrator" }, { status: "active" }, { emailVerified: true }, { consent: false },
    { email: "bad" }, { website: "bot" }, { password: "aaaaaaaaaaaaaa", confirmation: "aaaaaaaaaaaaaa" },
    { confirmation: "different" }, { password: "short" }]) assert.equal(forms.register.safeParse({ ...input, ...patch }).success, false);
  assert.equal(forms.profile.safeParse({ name: "Name", id: "another-user" }).success, false);
  assert.equal(forms.profile.safeParse({ name: "Name", email: "new@example.test" }).success, false);
});

test("account access requires both active state and verified email", () => {
  assert.equal(hasVerifiedAccess({ status: "active", emailVerified: true }), true);
  assert.equal(hasVerifiedAccess({ status: "active", emailVerified: false }), false);
  assert.equal(hasVerifiedAccess({ status: "suspended", emailVerified: true }), false);
  assert.equal(forms.reset.safeParse({ link: "invalid", password: input.password, confirmation: input.password }).success, false);
});
