import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { HttpError } from "./http.ts";

const tokenLifetime = 2 * 60 * 60 * 1000;
export const minimumSubmissionMs = 2500;

function signingKey() {
  const value = process.env.ENQUIRY_SIGNING_SECRET;
  if (!value || value.length < 32) throw new Error("ENQUIRY_SIGNING_SECRET must contain at least 32 characters.");
  return value;
}

export function sign(purpose: string, value: string) {
  return createHmac("sha256", signingKey()).update(purpose).update("\0").update(value).digest("base64url");
}

export function equalSecret(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function issueToken(now = Date.now()) {
  const data = `${randomUUID()}.${now}`;
  return `${data}.${sign("enquiry-token", data)}`;
}

export function checkToken(token: string, now = Date.now()) {
  const match = token.match(/^([a-f0-9-]{36})\.(\d{13})\.([\w-]{43})$/);
  if (!match) throw new HttpError(400, "Refresh the form and try again.");
  const [, id, issued, signature] = match;
  if (!equalSecret(signature, sign("enquiry-token", `${id}.${issued}`))) throw new HttpError(400, "Refresh the form and try again.");
  const age = now - Number(issued);
  if (age < minimumSubmissionMs) throw new HttpError(429, "Wait a moment and submit again.", 3);
  if (age > tokenLifetime) throw new HttpError(400, "This form has expired. Refresh it and try again.");
  return id;
}

export function checkOrigin(request: Request) {
  const expected = process.env.APP_ORIGIN;
  if (!expected || new URL(expected).origin !== expected) throw new Error("Configure APP_ORIGIN as a canonical origin.");
  if (request.headers.get("origin") !== expected || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new HttpError(403, "This submission must come from the PaLoNex website.");
  }
}

export function rateKeys(request: Request, email: string) {
  const trusted = process.env.ENQUIRY_TRUSTED_IP_HEADER || (process.env.VERCEL === "1" ? "x-vercel-forwarded-for" : "");
  const value = (trusted && request.headers.get(trusted)?.trim()) || "";
  const ip = isIP(value) ? value : "";
  return [
    { key: sign("email-rate", email), limit: 3 },
    { key: sign("network-rate", ip || "shared"), limit: ip ? 12 : 60 },
    { key: sign("global-rate", "all"), limit: 240 },
  ].sort((a, b) => a.key.localeCompare(b.key));
}
