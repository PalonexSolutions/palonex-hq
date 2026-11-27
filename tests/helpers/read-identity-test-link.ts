import { getDatabase } from "../../lib/server/database.ts";
import { identityMailLink } from "../../lib/server/identity-mail.ts";

const database = process.env.TEST_DATABASE_URL;
if (!database || !["127.0.0.1", "localhost"].includes(new URL(database).hostname)) throw new Error("Test database required.");
process.env.DATABASE_URL = database;
const [email, kind] = process.argv.slice(2);
if (!email?.endsWith("@example.test") || (kind !== "verify" && kind !== "reset")) throw new Error("Test fixture required.");
const db = getDatabase();
try {
  const { rows } = await db.query<{ id: string; payload: string }>(`
    SELECT m.id,m.payload FROM palonex_private.identity_mail m JOIN palonex_private.identity_user u ON u.id=m.user_id
    WHERE u.email=$1 AND m.kind=$2 AND m.consumed_at IS NULL AND m.payload IS NOT NULL`, [email, kind]);
  if (rows.length !== 1) throw new Error("Expected one current test link.");
  // The parent test captures this pipe in memory. It never prints the link.
  process.stdout.write(identityMailLink(kind, rows[0].payload, rows[0].id));
} finally { await db.end(); }
