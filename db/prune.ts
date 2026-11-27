import { getDatabase, transaction } from "../lib/server/database.ts";

const days = Number(process.env.ENQUIRY_RETENTION_DAYS || 365);
if (!Number.isInteger(days) || days < 30 || days > 3650) throw new Error("Retention must be between 30 and 3650 days.");
try {
  const summary = await transaction(async client => {
    const enquiries = await client.query("DELETE FROM palonex_private.enquiries WHERE created_at < now() - make_interval(days => $1)", [days]);
    const rateWindows = await client.query("DELETE FROM palonex_private.enquiry_rate_limits WHERE window_start < now() - interval '2 days'");
    const adminLimits = await client.query("DELETE FROM palonex_private.admin_login_limits WHERE window_start < now() - interval '2 days'");
    const expiredSessions = await client.query('DELETE FROM palonex_private.admin_session WHERE "expiresAt" <= now()');
    return { enquiries: enquiries.rowCount, rateWindows: rateWindows.rowCount, adminLimits: adminLimits.rowCount, expiredSessions: expiredSessions.rowCount };
  });
  console.log(JSON.stringify({ event: "database.retention_pruned", ...summary }));
} finally { await getDatabase().end(); }
