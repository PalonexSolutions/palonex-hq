import "server-only";
import { randomUUID } from "node:crypto";
import { categories } from "../../features/enquiries/constants.ts";
import { getDatabase } from "./database.ts";

export type Email = { from: string; to: string; subject: string; text: string; html: string };
export type MailProvider = { send(email: Email, idempotencyKey: string): Promise<void> };

export function resendProvider(apiKey: string): MailProvider {
  return {
    async send(email, idempotencyKey) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST", signal: AbortSignal.timeout(8000),
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(email),
      });
      await response.body?.cancel();
      if (!response.ok) throw new Error("Email provider rejected delivery.");
    },
  };
}

type Job = { enquiry_id: string; kind: "company" | "acknowledgement"; full_name: string; email: string; category: keyof typeof categories };
type Sender = { from: string; companyTo: string };

function escapeHtml(value: string) {
  const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return value.replace(/[&<>"']/g, char => entities[char]);
}

function buildEmail(job: Job, sender: Sender): Email {
  const company = job.kind === "company";
  const subject = company ? "New PaLoNex business enquiry" : "We received your PaLoNex enquiry";
  const detail = company ? `A new ${categories[job.category].toLowerCase()} is ready for authorized review.`
    : `Hello ${job.full_name}, thank you for contacting PaLoNex Solutions Private Limited. We’ve received your enquiry.`;
  const reference = `Enquiry reference: ${job.enquiry_id}`;
  return {
    from: sender.from, to: company ? sender.companyTo : job.email, subject,
    text: `PaLoNex Solutions Private Limited\n\n${detail}\n\n${reference}`,
    html: `<main style="font-family:Arial,sans-serif;background:#f3efe5;color:#24211c;padding:28px"><h1 style="color:#705326">PaLoNex</h1><h2>${subject}</h2><p>${escapeHtml(detail)}</p><p>${reference}</p></main>`,
  };
}

export async function deliverNotifications(provider: MailProvider, sender: Sender) {
  const db = getDatabase();
  const lease = randomUUID();
  // Stop automatic retries within the provider's 24-hour idempotency window.
  await db.query(`
    UPDATE palonex_private.enquiry_notifications SET failed_at=now(), lease_id=NULL
    WHERE sent_at IS NULL AND failed_at IS NULL AND available_at <= now()
      AND (attempts >= 6 OR first_attempt_at <= now() - interval '20 hours')`);
  const { rows } = await db.query<Job>(`
    WITH next_jobs AS (
      SELECT enquiry_id, kind FROM palonex_private.enquiry_notifications
      WHERE sent_at IS NULL AND failed_at IS NULL AND available_at <= now()
        AND attempts < 6 AND (first_attempt_at IS NULL OR first_attempt_at > now() - interval '20 hours')
      ORDER BY available_at, enquiry_id, kind LIMIT 5 FOR UPDATE SKIP LOCKED
    ), claimed AS (
      UPDATE palonex_private.enquiry_notifications AS job SET attempts=attempts+1, available_at=now() + interval '2 minutes',
        lease_id=$1, first_attempt_at=coalesce(first_attempt_at, now())
      FROM next_jobs WHERE job.enquiry_id=next_jobs.enquiry_id AND job.kind=next_jobs.kind
      RETURNING job.enquiry_id, job.kind
    )
    SELECT claimed.*, enquiries.full_name, enquiries.email, enquiries.category FROM claimed
    JOIN palonex_private.enquiries ON palonex_private.enquiries.id=claimed.enquiry_id`, [lease]);

  const results = await Promise.all(rows.map(async job => {
    const keys = [job.enquiry_id, job.kind, lease];
    try { await provider.send(buildEmail(job, sender), `enquiry-${job.enquiry_id}-${job.kind}`); }
    catch {
      await db.query(`UPDATE palonex_private.enquiry_notifications SET lease_id=NULL,
        available_at=now() + interval '5 minutes' * power(2, attempts - 1),
        failed_at=CASE WHEN attempts >= 6 THEN now() ELSE NULL END
        WHERE enquiry_id=$1 AND kind=$2 AND lease_id=$3`, keys);
      console.warn(JSON.stringify({ event: "notification.delivery_failed", id: job.enquiry_id, kind: job.kind }));
      return false;
    }
    await db.query(`UPDATE palonex_private.enquiry_notifications SET sent_at=now(), lease_id=NULL
      WHERE enquiry_id=$1 AND kind=$2 AND lease_id=$3`, keys);
    return true;
  }));
  return { sent: results.filter(Boolean).length, failed: results.filter(result => !result).length };
}
