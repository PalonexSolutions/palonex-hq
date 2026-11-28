import "server-only";
import { createHmac } from "node:crypto";
import { applicationOrigin, ConfigurationError } from "./deployment.ts";

export function identityConfig() {
  const secret = process.env.PUBLIC_AUTH_SECRET;
  if (!secret) throw new ConfigurationError("public_auth_secret_missing");
  if (secret.length < 32) throw new ConfigurationError("public_auth_secret_short");
  if (secret === process.env.BETTER_AUTH_SECRET) throw new ConfigurationError("public_auth_secret_shared");
  return { secret, ...applicationOrigin() };
}

export const identityKey = (purpose: string) =>
  createHmac("sha256", identityConfig().secret).update("palonex-identity\0").update(purpose).digest();
