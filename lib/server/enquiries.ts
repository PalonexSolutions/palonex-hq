import "server-only";
import type { PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { categories, privacyVersion } from "../../features/enquiries/constants.ts";
import { statuses, type EnquiryInput, type Status } from "../../features/enquiries/schema.ts";
import { getDatabase, transaction } from "./database.ts";
import { sign } from "./enquiry-security.ts";
import { HttpError } from "./http.ts";

type RateKey = { key: string; limit: number };

export async function saveEnquiry(submissionId: string, input: EnquiryInput, rateKeys: RateKey[]) {
  const { fullName, email, organization, category, subject, message } = input;
  const fingerprint = sign("enquiry-body", JSON.stringify([fullName, email, organization, category, subject, message]));
  return transaction(async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [submissionId]);
    const existing = await client.query<{ id: string; fingerprint: string }>(
      "SELECT id, fingerprint FROM palonex_private.enquiries WHERE submission_id=$1", [submissionId]);
    if (existing.rows[0]) {
      if (existing.rows[0].fingerprint !== fingerprint) throw new HttpError(409, "This form was already submitted. Refresh it to send another enquiry.");
      return { id: existing.rows[0].id, duplicate: true };
    }

    for (const { key, limit } of rateKeys) {
      const { rows } = await client.query<{ hits: number }>(`
        INSERT INTO palonex_private.enquiry_rate_limits (key, window_start, hits)
        VALUES ($1, date_trunc('hour', now(), 'UTC'), 1)
        ON CONFLICT (key, window_start) DO UPDATE SET hits=enquiry_rate_limits.hits+1
        RETURNING hits`, [key]);
      if (rows[0].hits > limit) throw new HttpError(429, "Too many enquiries. Try again in an hour.", 3600);
    }

    const id = randomUUID();
    await client.query(`
      INSERT INTO palonex_private.enquiries (id, submission_id, fingerprint, full_name, email, organization, category, subject, message, privacy_version)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [id, submissionId, fingerprint, fullName, email, organization, category, subject, message, privacyVersion]);
    await client.query("INSERT INTO palonex_private.enquiry_notifications (enquiry_id, kind) VALUES ($1,'company'), ($1,'acknowledgement')", [id]);
    return { id, duplicate: false };
  });
}

interface EnquirySummary {
  id: string;
  full_name: string;
  email: string;
  organization: string | null;
  subject: string;
  category: keyof typeof categories;
  status: Status;
  created_at: Date;
  updated_at: Date;
  status_changed_at: Date;
}

const listOptions = z.object({
  status: z.enum(statuses).optional(),
  category: z.enum(Object.keys(categories) as [keyof typeof categories, ...(keyof typeof categories)[]]).optional(),
  search: z.string().trim().max(150).optional(),
  limit: z.number().int().min(1).max(100).default(25),
  order: z.enum(["newest", "oldest"]).default("newest"),
  cursor: z.object({ time: z.iso.datetime(), id: z.uuid() }).optional(),
});

export async function listEnquiries(options: z.input<typeof listOptions> = {}) {
  const { status, category, search, limit, cursor, order } = listOptions.parse(options);
  const direction = order === "oldest" ? "ASC" : "DESC";
  const comparator = order === "oldest" ? ">" : "<";
  const { rows } = await getDatabase().query<EnquirySummary & { cursor_time: string }>(`
    SELECT id, full_name, email, organization, subject, category, status, created_at, updated_at, status_changed_at,
      to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_time
    FROM palonex_private.enquiries WHERE ($1::text IS NULL OR status=$1)
      AND ($2::text IS NULL OR category=$2)
      AND ($3::text IS NULL OR strpos(lower(concat_ws(' ', full_name, email, organization, subject, id::text)), lower($3)) > 0)
      AND ($4::timestamptz IS NULL OR (created_at, id) ${comparator} ($4::timestamptz, $5::uuid))
    ORDER BY created_at ${direction}, id ${direction} LIMIT $6`,
  [status ?? null, category ?? null, search || null, cursor?.time ?? null, cursor?.id ?? null, limit + 1]);
  const page = rows.slice(0, limit).map(({ cursor_time, ...item }) => ({ item, cursor: { time: cursor_time, id: item.id } }));
  const last = page.at(-1);
  return {
    items: page.map(({ item }) => item),
    nextCursor: rows.length > limit && last ? last.cursor : null,
  };
}

export const transitions: Record<Status, readonly Status[]> = {
  NEW: ["IN_PROGRESS", "ARCHIVED"],
  IN_PROGRESS: ["RESOLVED", "ARCHIVED"],
  RESOLVED: ["IN_PROGRESS", "ARCHIVED"],
  ARCHIVED: [],
};

export async function getEnquiry(id: string) {
  const { rows } = await getDatabase().query<EnquirySummary & { message: string; privacy_version: string; consented_at: Date }>(`
    SELECT id, full_name, email, organization, subject, category, message, privacy_version, consented_at,
      status, created_at, updated_at, status_changed_at FROM palonex_private.enquiries WHERE id=$1`, [z.uuid().parse(id)]);
  return rows[0] ?? null;
}

export async function transitionEnquiry(id: string, from: Status, to: Status, client?: PoolClient) {
  if (!transitions[from]?.includes(to)) throw new HttpError(409, "Invalid status transition.");
  const { rowCount } = await (client ?? getDatabase()).query(
    "UPDATE palonex_private.enquiries SET status=$3, updated_at=now(), status_changed_at=now() WHERE id=$1 AND status=$2",
    [z.uuid().parse(id), from, to]);
  if (!rowCount) throw new HttpError(409, "The enquiry status has changed or the record is unavailable.");
}
