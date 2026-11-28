import { getDatabase } from "@/lib/server/database";
import { handleError, json } from "@/lib/server/http";

export const dynamic = "force-dynamic";

const required = [
  "enquiries", "enquiry_notifications", "enquiry_rate_limits", "enquiry_notes", "enquiry_audit",
  "admin_user", "admin_account", "admin_session", "admin_staff", "admin_login_limits",
  "identity_user", "identity_account", "identity_session", "identity_verification",
  "identity_rate", "identity_role", "identity_mail", "identity_audit",
].map(table => `palonex_private.${table}`);

export async function GET() {
  try {
    const { rows: [result] } = await getDatabase().query<{ ready: boolean }>(`
      SELECT bool_and(coalesce(has_table_privilege(relation, 'SELECT'), false)) AS ready
      FROM (SELECT to_regclass(name) AS relation FROM unnest($1::text[]) AS name) AS required`, [required]);
    if (!result.ready) throw new Error("The runtime schema is incomplete or inaccessible.");
    return json({ status: "ok" });
  } catch (error) { return handleError("database.health_failed", error); }
}
