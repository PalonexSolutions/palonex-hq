import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { getDatabase, transaction } from "./database.ts";
import { identityConfig, identityKey } from "./identity-config.ts";
import { HttpError } from "./http.ts";
import type { MailProvider } from "./notifications.ts";

type Kind = "verify" | "reset";
type Payload = { link: string; token: string };
const digest = (link: string) => createHash("sha256").update(link).digest("base64url");

function encrypt(value: Payload, id: string) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", identityKey("mail"), nonce).setAAD(Buffer.from(id));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString("base64url");
}

function decrypt(value: string, id: string): Payload {
  const bytes = Buffer.from(value, "base64url");
  const cipher = createDecipheriv("aes-256-gcm", identityKey("mail"), bytes.subarray(0, 12))
    .setAAD(Buffer.from(id)).setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString("utf8"));
}

export async function enqueueIdentityEmail(kind: Kind, userId: string, token: string) {
  const id = randomUUID();
  const link = randomBytes(32).toString("base64url");
  await transaction(async client => {
    const { rowCount } = await client.query(`
      SELECT id FROM palonex_private.identity_user
      WHERE id=$1 AND status='active' AND ($2 <> 'verify' OR NOT "emailVerified") FOR UPDATE`, [userId, kind]);
    if (!rowCount) return;
    await client.query(`
      UPDATE palonex_private.identity_mail SET consumed_at=now(), payload=NULL
      WHERE user_id=$1 AND kind=$2 AND consumed_at IS NULL`, [userId, kind]);
    await client.query(`
      INSERT INTO palonex_private.identity_mail (id,user_id,kind,digest,payload,expires_at)
      VALUES ($1,$2,$3,$4,$5,now() + make_interval(secs => $6))`,
    [id, userId, kind, digest(link), encrypt({ link, token }, id), kind === "verify" ? 3600 : 1800]);
  });
}

export async function consumeIdentityLink(kind: Kind, link: string) {
  // The encrypted payload is retained until use or expiry, including after successful delivery.
  const { rows } = await getDatabase().query<{ id: string; payload: string }>(`
    UPDATE palonex_private.identity_mail AS m SET consumed_at=now()
    FROM palonex_private.identity_user AS u
    WHERE m.user_id=u.id AND m.digest=$1 AND m.kind=$2 AND m.consumed_at IS NULL
      AND m.expires_at > now() AND m.payload IS NOT NULL AND u.status='active'
      AND ($2 <> 'verify' OR NOT u."emailVerified")
    RETURNING m.id,m.payload`, [digest(link), kind]);
  const row = rows[0];
  if (!row) throw new HttpError(400, "This link is invalid, expired or already used. Request a new link.");
  const { token } = decrypt(row.payload, row.id);
  await getDatabase().query("UPDATE palonex_private.identity_mail SET payload=NULL WHERE id=$1", [row.id]);
  return token;
}

export function identityMailLink(kind: Kind, ciphertext: string, id: string) {
  const { link } = decrypt(ciphertext, id);
  // Fragments stay in the browser and out of HTTP access logs.
  return `${identityConfig().origin}/${kind === "verify" ? "verify-email" : "reset-password"}#${link}`;
}

export async function deliverIdentityMail(provider: MailProvider, from: string) {
  const db = getDatabase();
  const lease = randomUUID();
  const { rows } = await db.query<{ id: string; kind: Kind; payload: string; email: string }>(`
    WITH jobs AS (
      SELECT m.id FROM palonex_private.identity_mail m JOIN palonex_private.identity_user u ON u.id=m.user_id
      WHERE m.expires_at>now() AND m.consumed_at IS NULL AND m.payload IS NOT NULL
        AND m.sent_at IS NULL AND m.attempts<5 AND m.available_at<=now() AND u.status='active'
      ORDER BY m.available_at, m.id LIMIT 5 FOR UPDATE OF m SKIP LOCKED
    ), claimed AS (
      UPDATE palonex_private.identity_mail m SET lease=$1,attempts=attempts+1,available_at=now()+interval '2 minutes'
      FROM jobs WHERE m.id=jobs.id RETURNING m.id,m.kind,m.payload,m.user_id
    )
    SELECT claimed.id, claimed.kind, claimed.payload,u.email FROM claimed JOIN palonex_private.identity_user u ON u.id=claimed.user_id`, [lease]);
  const results = await Promise.all(rows.map(async row => {
    try {
      const verify = row.kind === "verify";
      const url = identityMailLink(row.kind, row.payload, row.id);
      const subject = verify ? "Verify your PaLoNex account" : "Reset your PaLoNex password";
      const text = `${subject}\n\n${url}\n\nIf you did not request this email, you can ignore it.`;
      await provider.send({ from, to: row.email, subject, text, html: `<p>${subject}</p><p><a href="${url}">Continue to PaLoNex</a></p><p>If you did not request this email, you can ignore it.</p>` }, `identity-${row.id}`);
      await db.query("UPDATE palonex_private.identity_mail SET sent_at=now(),lease=NULL WHERE id=$1 AND lease=$2", [row.id, lease]);
      return true;
    } catch {
      await db.query("UPDATE palonex_private.identity_mail SET available_at=now()+interval '5 minutes',lease=NULL WHERE id=$1 AND lease=$2", [row.id, lease]);
      console.warn(JSON.stringify({ event: "identity.mail_delivery_failed", id: row.id }));
      return false;
    }
  }));
  return { sent: results.filter(Boolean).length, failed: results.filter(value => !value).length };
}
