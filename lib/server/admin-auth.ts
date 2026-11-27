import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { betterAuth } from "better-auth";
import { hashPassword } from "better-auth/crypto";
import { PostgresDialect } from "kysely";
import { z } from "zod";
import { staffEmail } from "../../features/admin/schema.ts";
import { getDatabase, transaction } from "./database.ts";
import { HttpError } from "./http.ts";

function config() {
  const secret = process.env.BETTER_AUTH_SECRET;
  const origin = process.env.APP_ORIGIN;
  if (!secret || secret.length < 32 || !origin) throw new HttpError(503, "Administrator sign-in is not configured.");
  const address = new URL(origin);
  const secure = address.protocol === "https:";
  if (address.origin !== origin || (!secure && (address.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(address.hostname)))) {
    throw new HttpError(503, "Administrator sign-in requires a configured HTTPS origin.");
  }
  return { secret, origin, secure };
}

function buildAuth() {
  const { secret, origin, secure } = config();
  return betterAuth({
    appName: "PaLoNex HQ Admin",
    baseURL: origin,
    secret,
    database: { dialect: new PostgresDialect({ pool: getDatabase() }), type: "postgres", schemaName: "palonex_private" },
    user: { modelName: "admin_user" },
    account: { modelName: "admin_account" },
    verification: { modelName: "admin_verification" },
    session: { modelName: "admin_session", expiresIn: 8 * 60 * 60, disableSessionRefresh: true, cookieCache: { enabled: false } },
    emailAndPassword: { enabled: true, disableSignUp: true, requireEmailVerification: true, minPasswordLength: 14 },
    advanced: {
      cookiePrefix: "palonex-admin", useSecureCookies: secure,
      defaultCookieAttributes: { sameSite: "strict", httpOnly: true, secure },
      ipAddress: { disableIpTracking: true },
    },
    rateLimit: { enabled: false },
    logger: { disabled: true },
  });
}
let auth: ReturnType<typeof buildAuth> | undefined;
export function getAdminAuth() { return auth ??= buildAuth(); }

export async function enabledStaff(id: string) {
  const result = await getDatabase().query("SELECT 1 FROM palonex_private.admin_staff WHERE user_id=$1 AND enabled", [id]);
  return Boolean(result.rowCount);
}

export async function requireAdmin(headers: Headers) {
  const session = await getAdminAuth().api.getSession({ headers });
  if (!session || !await enabledStaff(session.user.id)) throw new HttpError(401, "Administrator authentication required.");
  return { id: session.user.id, name: session.user.name, sessionId: session.session.id };
}

export async function limitLogin(request: Request, email: string) {
  const { secret } = config();
  const header = process.env.ENQUIRY_TRUSTED_IP_HEADER || (process.env.VERCEL === "1" ? "x-vercel-forwarded-for" : "");
  const value = header ? request.headers.get(header)?.trim() || "" : "";
  const keys = [[`account:${email}`, 10], [isIP(value) ? `ip:${value}` : "shared", isIP(value) ? 25 : 80], ["global", 200]] as const;
  await transaction(async client => {
    for (const [key, limit] of keys) {
      const digest = createHmac("sha256", secret).update("admin-login\0").update(key).digest("base64url");
      const { rows } = await client.query<{ hits: number }>(`
        INSERT INTO palonex_private.admin_login_limits (key, window_start, hits)
        VALUES ($1, date_bin('15 minutes', now(), '2000-01-01 00:00:00+00'), 1)
        ON CONFLICT (key, window_start) DO UPDATE SET hits=admin_login_limits.hits + 1 RETURNING hits`, [digest]);
      if (rows[0].hits > limit) throw new HttpError(429, "Too many sign-in attempts. Try again in 15 minutes.", 900);
    }
  });
}

export async function provisionAdmin(email: string, name: string, password: string) {
  const validEmail = staffEmail.parse(email);
  const validName = z.string().trim().min(2).max(100).parse(name);
  const validPassword = z.string().min(14).max(128).parse(password);
  const hash = await hashPassword(validPassword);
  const id = randomUUID();
  await transaction(async client => {
    await client.query(`
      INSERT INTO palonex_private.admin_user (id,name,email,"emailVerified","createdAt","updatedAt")
      VALUES ($1,$2,$3,true,now(),now())`, [id, validName, validEmail]);
    await client.query(`
      INSERT INTO palonex_private.admin_account (id,"accountId","providerId","userId",password,"createdAt","updatedAt")
      VALUES ($1,$2,'credential',$2,$3,now(),now())`, [randomUUID(), id, hash]);
    await client.query("INSERT INTO palonex_private.admin_staff (user_id) VALUES ($1)", [id]);
  });
  return id;
}

export async function disableAdmin(email: string) {
  const validEmail = staffEmail.parse(email);
  return transaction(async client => {
    const { rows } = await client.query<{ user_id: string }>(`
      UPDATE palonex_private.admin_staff s SET enabled=false FROM palonex_private.admin_user u
      WHERE s.user_id=u.id AND u.email=$1 RETURNING s.user_id`, [validEmail]);
    if (!rows[0]) return false;
    await client.query('DELETE FROM palonex_private.admin_session WHERE "userId"=$1', [rows[0].user_id]);
    return true;
  });
}
