import "server-only";
import { createHmac } from "node:crypto";
import { applicationOrigin } from "./deployment.ts";
import { HttpError } from "./http.ts";

export function identityConfig() {
  const secret = process.env.PUBLIC_AUTH_SECRET;
  if (!secret || secret.length < 32 || secret === process.env.BETTER_AUTH_SECRET)
    throw new HttpError(503, "Public accounts are temporarily unavailable.");
  return { secret, ...applicationOrigin() };
}

export const identityKey = (purpose: string) =>
  createHmac("sha256", identityConfig().secret).update("palonex-identity\0").update(purpose).digest();
