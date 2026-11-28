import "server-only";
import { isIP } from "node:net";

export const canonicalOrigin = "https://palonexsolutions.in";
export type Environment = Readonly<Record<string, string | undefined>>;

export type ConfigurationIssue =
  | "vercel_metadata" | "app_origin_missing" | "app_origin_invalid" | "database_url_invalid"
  | "direct_credentials_at_runtime" | "database_pooler_required" | "database_role_invalid"
  | "database_tls_or_parameters_invalid" | "database_host_mismatch" | "preview_database_not_isolated"
  | "database_pool_size_invalid" | "public_auth_secret_missing" | "public_auth_secret_short" | "public_auth_secret_shared";

export class ConfigurationError extends Error {
  readonly issue: ConfigurationIssue;

  constructor(issue: ConfigurationIssue) {
    super("Runtime configuration is invalid.");
    this.name = "ConfigurationError";
    this.issue = issue;
  }
}

export function deploymentStage(env: Environment = process.env) {
  if (env.VERCEL_ENV === "production" || env.VERCEL_ENV === "preview") return env.VERCEL_ENV;
  if (env.VERCEL === "1" && env.VERCEL_ENV !== "development") throw new ConfigurationError("vercel_metadata");
  return "local";
}

export function applicationOrigin(env: Environment = process.env) {
  const origin = env.APP_ORIGIN;
  if (!origin) throw new ConfigurationError("app_origin_missing");
  let parsed: URL;
  try { parsed = new URL(origin); }
  catch { throw new ConfigurationError("app_origin_invalid"); }
  const stage = deploymentStage(env);
  const secure = parsed.protocol === "https:";
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  const productionHost = ["palonexsolutions.in", "www.palonexsolutions.in"].includes(parsed.hostname);
  if (parsed.origin !== origin || (!secure && (parsed.protocol !== "http:" || !loopback))
    || (stage === "production" && origin !== canonicalOrigin)
    || (stage === "preview" && (!secure || loopback || productionHost))) {
    throw new ConfigurationError("app_origin_invalid");
  }
  return { origin, secure };
}

function databaseUrl(value: string | undefined) {
  try {
    if (!value) throw new Error();
    const url = new URL(value);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || url.hash
      || url.searchParams.has("host") || url.searchParams.has("hostaddr")) throw new Error();
    return url;
  } catch {
    throw new ConfigurationError("database_url_invalid");
  }
}

const neonHost = (host: string) => /^(?:[a-z0-9-]+\.)+neon\.tech$/.test(host);
const poolerHost = (host: string) => neonHost(host) && host.split(".")[0].endsWith("-pooler");

function verifiedTls(url: URL) {
  const supported = new Set(["sslmode", "channel_binding", "application_name"]);
  const keys = [...url.searchParams.keys()];
  if ((url.port && url.port !== "5432") || url.searchParams.get("sslmode") !== "verify-full"
    || keys.some(key => !supported.has(key) || url.searchParams.getAll(key).length !== 1)) {
    throw new ConfigurationError("database_tls_or_parameters_invalid");
  }
}

export function runtimeDatabaseUrl(env: Environment = process.env) {
  const url = databaseUrl(env.DATABASE_URL);
  const stage = deploymentStage(env);
  if (env.DATABASE_URL_UNPOOLED && stage !== "local") throw new ConfigurationError("direct_credentials_at_runtime");
  if (stage !== "local" || neonHost(url.hostname)) {
    if (!poolerHost(url.hostname)) throw new ConfigurationError("database_pooler_required");
    if (stage !== "local" && url.username !== "palonex_runtime") throw new ConfigurationError("database_role_invalid");
    verifiedTls(url);
  }
  if (stage !== "local" && url.hostname !== env.NEON_RUNTIME_HOST) throw new ConfigurationError("database_host_mismatch");
  if (stage === "preview" && (!poolerHost(env.NEON_PRODUCTION_HOST ?? "") || url.hostname === env.NEON_PRODUCTION_HOST)) {
    throw new ConfigurationError("preview_database_not_isolated");
  }
  return env.DATABASE_URL!;
}

export function operatorDatabaseUrl(env: Environment = process.env) {
  if (deploymentStage(env) !== "local") throw new Error("Run database operator commands outside the hosted application.");
  const value = env.DATABASE_URL_UNPOOLED || env.DATABASE_URL;
  const url = databaseUrl(value);
  const hosted = neonHost(url.hostname);
  if (hosted || env.NEON_RUNTIME_HOST) {
    if (!hosted || !env.DATABASE_URL_UNPOOLED || poolerHost(url.hostname)) throw new Error("Provide a direct Neon DATABASE_URL_UNPOOLED.");
    verifiedTls(url);
    if (!poolerHost(env.NEON_RUNTIME_HOST ?? "") || env.NEON_RUNTIME_HOST?.replace("-pooler.", ".") !== url.hostname)
      throw new Error("The direct Neon host must match the expected branch endpoint.");
  } else if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new Error("Local fallback is limited to loopback. Provide a direct Neon connection and branch pin.");
  }
  return value!;
}

export function trustedClientIp(request: Request, env: Environment = process.env) {
  const header = env.VERCEL === "1" ? "x-vercel-forwarded-for" : env.ENQUIRY_TRUSTED_IP_HEADER;
  const value = header ? request.headers.get(header)?.trim() ?? "" : "";
  return isIP(value) ? value : "";
}
