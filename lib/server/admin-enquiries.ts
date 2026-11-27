import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { enquiryChange } from "../../features/admin/schema.ts";
import { getDatabase, transaction } from "./database.ts";
import { getEnquiry, transitionEnquiry } from "./enquiries.ts";
import { HttpError } from "./http.ts";

export type QueueStats = { pending: number; accepted: number; failed: number; oldest_pending: Date | null; pending_hours: number | null };
export async function queueStats() {
  const { rows } = await getDatabase().query<QueueStats>(`
    SELECT count(*) FILTER (WHERE sent_at IS NULL AND failed_at IS NULL)::int AS pending,
      count(sent_at)::int AS accepted, count(failed_at)::int AS failed,
      min(e.created_at) FILTER (WHERE sent_at IS NULL AND failed_at IS NULL) AS oldest_pending,
      floor(extract(epoch FROM now() - min(e.created_at) FILTER (WHERE sent_at IS NULL AND failed_at IS NULL)) / 3600)::int AS pending_hours
    FROM palonex_private.enquiry_notifications n JOIN palonex_private.enquiries e ON n.enquiry_id=e.id`);
  return rows[0];
}

export async function overview() {
  const db = getDatabase();
  const [counts, recent, volume, notifications] = await Promise.all([
    db.query<{ total: number; new: number; in_progress: number; resolved: number }>(`
      SELECT count(*)::int AS total, count(*) FILTER (WHERE status='NEW')::int AS new,
        count(*) FILTER (WHERE status='IN_PROGRESS')::int AS in_progress,
        count(*) FILTER (WHERE status='RESOLVED')::int AS resolved FROM palonex_private.enquiries`),
    db.query<{ id: string; status: string; subject: string; created_at: Date }>(`
      SELECT id, status, subject, created_at FROM palonex_private.enquiries ORDER BY created_at DESC, id DESC LIMIT 5`),
    db.query<{ day: string; total: number }>(`
      SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, count(*)::int AS total
      FROM palonex_private.enquiries WHERE created_at >= date_trunc('day', now(), 'UTC') - interval '13 days'
      GROUP BY day ORDER BY day`),
    queueStats(),
  ]);
  return { counts: counts.rows[0], recent: recent.rows, volume: volume.rows, notifications };
}

export async function recentDeliveries() {
  const { rows } = await getDatabase().query<{
    enquiry_id: string; kind: string; attempts: number; available_at: Date;
    sent_at: Date | null; failed_at: Date | null; first_attempt_at: Date | null; queued_at: Date;
  }>(`
    SELECT n.enquiry_id, n.kind, n.attempts, n.available_at, n.sent_at, n.failed_at, n.first_attempt_at, e.created_at AS queued_at
    FROM palonex_private.enquiry_notifications n JOIN palonex_private.enquiries e ON n.enquiry_id=e.id
    ORDER BY coalesce(n.failed_at, n.sent_at, n.first_attempt_at, e.created_at) DESC, n.enquiry_id, n.kind LIMIT 50`);
  return rows;
}

export async function adminEnquiry(id: string) {
  const enquiry = await getEnquiry(id);
  if (!enquiry) return null;
  const [notes, audit] = await Promise.all([
    getDatabase().query<{ id: string; actor_id: string; body: string; created_at: Date }>(`
      SELECT id, actor_id, body, created_at FROM palonex_private.enquiry_notes WHERE enquiry_id=$1
      ORDER BY created_at DESC, id DESC LIMIT 50`, [id]),
    getDatabase().query<{ id: string; actor_id: string; action: string; previous_status: string | null; new_status: string | null; created_at: Date }>(`
      SELECT id, actor_id, action, previous_status, new_status, created_at FROM palonex_private.enquiry_audit
      WHERE enquiry_id=$1 ORDER BY id DESC LIMIT 50`, [id]),
  ]);
  return { enquiry, notes: notes.rows, audit: audit.rows };
}

export async function changeEnquiry(actor: string, id: string, change: z.output<typeof enquiryChange>) {
  await transaction(async client => {
    const { rowCount } = await client.query("SELECT id FROM palonex_private.enquiries WHERE id=$1 FOR UPDATE", [id]);
    if (!rowCount) throw new HttpError(404, "Enquiry not found.");
    if (change.action === "status") {
      await transitionEnquiry(id, change.from, change.to, client);
      await client.query(`
        INSERT INTO palonex_private.enquiry_audit (enquiry_id, actor_id, action, previous_status, new_status)
        VALUES ($1,$2,'status_changed',$3,$4)`, [id, actor, change.from, change.to]);
    } else {
      await client.query("INSERT INTO palonex_private.enquiry_notes (id, enquiry_id, actor_id, body) VALUES ($1,$2,$3,$4)",
        [randomUUID(), id, actor, change.note]);
      await client.query("INSERT INTO palonex_private.enquiry_audit (enquiry_id, actor_id, action) VALUES ($1,$2,'note_added')", [id, actor]);
    }
  });
}
