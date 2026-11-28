import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { PostgresDialect } from "kysely";
import { hasVerifiedAccess, type PublicRole } from "../../features/identity/schema.ts";
import { getDatabase, transaction } from "./database.ts";
import { identityConfig, identityKey } from "./identity-config.ts";
import { enqueueIdentityEmail } from "./identity-mail.ts";
import { trustedClientIp } from "./deployment.ts";
import { captureRegistrationAuthError } from "./registration-diagnostics.ts";
import { HttpError } from "./http.ts";

function buildIdentityAuth({ secret, origin, secure } = identityConfig(), pool = getDatabase()) {
  return betterAuth({
    appName: "PaLoNex Accounts", baseURL: origin, trustedOrigins: [origin], secret, basePath: "/api/identity/engine",
    database: { dialect: new PostgresDialect({ pool }), type: "postgres", schemaName: "palonex_private", transaction: true },
    user: { modelName: "identity_user", additionalFields: {
      consentVersion: { type: "string", required: true },
      consentedAt: { type: "date", required: true },
      status: { type: "string", required: false, input: false, defaultValue: "active" },
    } },
    account: { modelName: "identity_account" },
    session: { modelName: "identity_session", expiresIn: 7 * 86400, disableSessionRefresh: true, cookieCache: { enabled: false } },
    verification: { modelName: "identity_verification", storeIdentifier: "hashed" },
    emailAndPassword: {
      enabled: true, autoSignIn: false, requireEmailVerification: true, minPasswordLength: 14, maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true, resetPasswordTokenExpiresIn: 1800,
      sendResetPassword: ({ user, token }) => enqueueIdentityEmail("reset", user.id, token),
    },
    emailVerification: {
      sendOnSignUp: false, sendOnSignIn: false, autoSignInAfterVerification: false, expiresIn: 3600,
      sendVerificationEmail: ({ user, token }) => enqueueIdentityEmail("verify", user.id, token),
    },
    advanced: {
      database: { generateId: () => randomUUID() },
      cookiePrefix: "palonex-public", useSecureCookies: secure,
      defaultCookieAttributes: { sameSite: "lax", httpOnly: true, secure },
      ipAddress: { disableIpTracking: true },
    },
    rateLimit: { enabled: false },
    logger: { level: "error", log: (_level, _message, ...args) => captureRegistrationAuthError(...args) },
  });
}

let auth: ReturnType<typeof buildIdentityAuth> | undefined;
export function identityAuth(config?: ReturnType<typeof identityConfig>, pool?: ReturnType<typeof getDatabase>) {
  return auth ??= buildIdentityAuth(config, pool);
}

export function hasPublicCookie(headers: Headers) {
  return (headers.get("cookie") ?? "").split(";")
    .some(part => /^(?:__Secure-)?palonex-public\.session_token=/.test(part.trim()));
}

export async function currentIdentity(headers: Headers) {
  if (!hasPublicCookie(headers)) return null;
  const data = await identityAuth().api.getSession({ headers });
  if (!data || !hasVerifiedAccess({ status: data.user.status ?? "", emailVerified: data.user.emailVerified })) return null;
  return {
    id: data.user.id, name: data.user.name, email: data.user.email, emailVerified: data.user.emailVerified,
    createdAt: data.user.createdAt, sessionId: data.session.id,
  };
}

export async function requireIdentity(headers: Headers, role: PublicRole = "registered") {
  const user = await currentIdentity(headers);
  if (!user) throw new HttpError(401, "Sign in to your verified PaLoNex account.");
  if (role !== "registered") {
    const { rowCount } = await getDatabase().query(
      "SELECT 1 FROM palonex_private.identity_role WHERE user_id=$1 AND role=$2", [user.id, role]);
    if (!rowCount) throw new HttpError(403, "Your account does not have this permission.");
  }
  return user;
}

const limits = { register: 3, login: 10, resend: 3, forgot: 3, verify: 8, reset: 8, password: 6, profile: 20 } as const;

export async function limitIdentity(request: Request, operation: keyof typeof limits, subject: string) {
  const value = trustedClientIp(request);
  const keys = [[`subject:${subject}`, limits[operation]], [value ? `network:${value}` : "shared", value ? 30 : 90], ["global", 240]] as const;
  const secret = identityKey("rate");
  await transaction(async client => {
    for (const [key, maximum] of keys) {
      const digest = createHmac("sha256", secret).update(operation).update("\0").update(key).digest("base64url");
      const { rows } = await client.query<{ hits: number }>(`
        INSERT INTO palonex_private.identity_rate (key,window_start,hits)
        VALUES ($1,date_bin('15 minutes',now(),'2000-01-01 00:00:00+00'),1)
        ON CONFLICT (key,window_start) DO UPDATE SET hits=identity_rate.hits+1 RETURNING hits`, [digest]);
      if (rows[0].hits > maximum) throw new HttpError(429, "Too many attempts. Try again in 15 minutes.", 900);
    }
  });
}
