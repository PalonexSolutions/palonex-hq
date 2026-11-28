import { operatorDatabase, transaction } from "../lib/server/database.ts";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log(JSON.stringify({ event: "database.retention_paused", instruction: "Use npm run db:prune -- --apply after verifying the target database." }));
} else if (args.length !== 1 || args[0] !== "--apply") {
  console.error("Usage: npm run db:prune -- --apply");
  process.exitCode = 1;
} else {
  await prune();
}

async function prune() {
  const days = Number(process.env.ENQUIRY_RETENTION_DAYS || 365);
  if (!Number.isInteger(days) || days < 30 || days > 3650) throw new Error("Retention must be between 30 and 3650 days.");
  const pool = operatorDatabase();
  try {
    const summary = await transaction(async client => {
      const enquiries = await client.query("DELETE FROM palonex_private.enquiries WHERE created_at < now() - make_interval(days => $1)", [days]);
      const rateWindows = await client.query("DELETE FROM palonex_private.enquiry_rate_limits WHERE window_start < now() - interval '2 days'");
      const adminLimits = await client.query("DELETE FROM palonex_private.admin_login_limits WHERE window_start < now() - interval '2 days'");
      const expiredSessions = await client.query('DELETE FROM palonex_private.admin_session WHERE "expiresAt" <= now()');
      const identityRates = await client.query("DELETE FROM palonex_private.identity_rate WHERE window_start < now() - interval '2 days'");
      const identitySessions = await client.query('DELETE FROM palonex_private.identity_session WHERE "expiresAt" <= now()');
      const identityVerification = await client.query('DELETE FROM palonex_private.identity_verification WHERE "expiresAt" <= now()');
      const identityMail = await client.query("DELETE FROM palonex_private.identity_mail WHERE expires_at <= now()");
      return { identityRates: identityRates.rowCount, identitySessions: identitySessions.rowCount,
        identityVerification: identityVerification.rowCount, identityMail: identityMail.rowCount, enquiries: enquiries.rowCount, rateWindows: rateWindows.rowCount, adminLimits: adminLimits.rowCount, expiredSessions: expiredSessions.rowCount };
    }, pool, 60_000);
    console.log(JSON.stringify({ event: "database.retention_pruned", ...summary }));
  } finally { await pool.end(); }
}
