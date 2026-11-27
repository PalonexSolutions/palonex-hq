import "server-only";
import { getDatabase, transaction } from "./database.ts";
import { HttpError } from "./http.ts";

export async function identityCounts() {
  const { rows } = await getDatabase().query<{ total: number; verified: number; suspended: number }>(`
    SELECT count(*)::int AS total, count(*) FILTER (WHERE "emailVerified")::int AS verified,
      count(*) FILTER (WHERE status='suspended')::int AS suspended FROM palonex_private.identity_user`);
  return rows[0];
}

export async function identityListing(search: string, page: number) {
  const { rows } = await getDatabase().query<{
    id: string; name: string; email: string; emailVerified: boolean; createdAt: Date; status: "active" | "suspended";
  }>(`
    SELECT id,name,email,"emailVerified","createdAt",status FROM palonex_private.identity_user
    WHERE $1='' OR strpos(lower(concat_ws(' ',name,email,id)),lower($1))>0
    ORDER BY "createdAt" DESC,id DESC LIMIT 26 OFFSET $2`, [search, (page - 1) * 25]);
  return { items: rows.slice(0, 25), more: rows.length > 25 };
}

export async function changeIdentityStatus(actor: string, id: string, from: "active" | "suspended", to: "active" | "suspended") {
  if (from === to) throw new HttpError(400, "Choose a different account status.");
  await transaction(async client => {
    const { rowCount } = await client.query('UPDATE palonex_private.identity_user SET status=$3,"updatedAt"=now() WHERE id=$1 AND status=$2', [id, from, to]);
    if (!rowCount) throw new HttpError(409, "This account changed or is unavailable. Refresh the list.");
    if (to === "suspended") {
      await client.query('DELETE FROM palonex_private.identity_session WHERE "userId"=$1', [id]);
      await client.query('UPDATE palonex_private.identity_mail SET consumed_at=now(),payload=NULL WHERE user_id=$1 AND consumed_at IS NULL', [id]);
    }
    await client.query(`
      INSERT INTO palonex_private.identity_audit (user_id,actor_id,previous_status,new_status) VALUES ($1,$2,$3,$4)`, [id, actor, from, to]);
  });
}
