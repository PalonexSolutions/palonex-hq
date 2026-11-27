import "server-only";
import { createHmac } from "node:crypto";
import { HttpError } from "./http.ts";

export function identityConfig() {
  const secret = process.env.PUBLIC_AUTH_SECRET;
  const origin = process.env.APP_ORIGIN;
  if (!secret || secret.length < 32 || !origin || secret === process.env.BETTER_AUTH_SECRET)
    throw new HttpError(503, "Public accounts are temporarily unavailable.");
  const address = new URL(origin);
  const secure = address.protocol === "https:";
  if (address.origin !== origin || (!secure && (address.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(address.hostname))))
    throw new HttpError(503, "Public accounts require a configured HTTPS origin.");
  return { secret, origin, secure };
}

export const identityKey = (purpose: string) =>
  createHmac("sha256", identityConfig().secret).update("palonex-identity\0").update(purpose).digest();
