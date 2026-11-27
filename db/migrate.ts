import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { getDatabase, transaction } from "../lib/server/database.ts";

const directory = new URL("./migrations/", import.meta.url);
const files = (await readdir(directory)).filter(name => /^\d+_.+\.sql$/.test(name)).sort();
try {
  await transaction(async client => {
    await client.query("SELECT pg_advisory_xact_lock(7283104)");
    await client.query("CREATE SCHEMA IF NOT EXISTS palonex_private");
    await client.query("REVOKE ALL ON SCHEMA palonex_private FROM PUBLIC");
    await client.query(`CREATE TABLE IF NOT EXISTS palonex_private.schema_migrations (
      name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    for (const name of files) {
      const sql = await readFile(new URL(name, directory), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const result = await client.query<{ checksum: string }>("SELECT checksum FROM palonex_private.schema_migrations WHERE name=$1", [name]);
      if (result.rows[0]?.checksum === checksum) continue;
      if (result.rowCount) throw new Error(`Applied migration changed: ${name}`);
      await client.query(sql);
      await client.query("INSERT INTO palonex_private.schema_migrations (name, checksum) VALUES ($1, $2)", [name, checksum]);
      console.log(JSON.stringify({ event: "database.migration_applied", name }));
    }
  });
} finally { await getDatabase().end(); }
