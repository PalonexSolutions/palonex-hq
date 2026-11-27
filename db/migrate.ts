import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import type { PoolClient } from "pg";
import { operatorDatabase, transaction } from "../lib/server/database.ts";

const directory = new URL("./migrations/", import.meta.url);
const names = (await readdir(directory)).filter(name => name.endsWith(".sql")).sort();
if (!names.length || names.some((name, index) => !/^\d{3}_[a-z0-9_]+\.sql$/.test(name) || Number(name.slice(0, 3)) !== index + 1)) {
  throw new Error("Migration files must form a contiguous numbered history.");
}
const files = await Promise.all(names.map(async name => {
  const sql = await readFile(new URL(name, directory), "utf8");
  return { name, sql, checksum: createHash("sha256").update(sql).digest("hex") };
}));

async function pendingMigrations(client: PoolClient) {
  const { rows: [relation] } = await client.query<{ present: boolean }>(
    "SELECT to_regclass('palonex_private.schema_migrations') IS NOT NULL AS present",
  );
  if (!relation.present) return files;
  const { rows } = await client.query<{ name: string; checksum: string }>(
    "SELECT name, checksum FROM palonex_private.schema_migrations ORDER BY name",
  );
  rows.forEach((row, index) => {
    if (files[index]?.name !== row.name || files[index].checksum !== row.checksum)
      throw new Error("Applied migration history does not match the release files.");
  });
  return files.slice(rows.length);
}

const mode = process.argv[2] || "apply";
if (!["apply", "status"].includes(mode)) throw new Error("Use apply or status.");
const pool = operatorDatabase();
try {
  if (mode === "status") {
    const client = await pool.connect();
    try {
      const pending = await pendingMigrations(client);
      console.log(JSON.stringify({ event: "database.migration_status", applied: files.length - pending.length, pending: pending.map(file => file.name) }));
      if (pending.length) process.exitCode = 1;
    } finally { client.release(); }
  } else {
    const applied = await transaction(async client => {
      const { rows: [lock] } = await client.query<{ acquired: boolean }>("SELECT pg_try_advisory_xact_lock(7283104) AS acquired");
      if (!lock.acquired) throw new Error("Another migration operator holds the migration lock.");
      const pending = await pendingMigrations(client);
      await client.query("CREATE SCHEMA IF NOT EXISTS palonex_private");
      await client.query("REVOKE ALL ON SCHEMA palonex_private FROM PUBLIC");
      await client.query(`CREATE TABLE IF NOT EXISTS palonex_private.schema_migrations (
        name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
      )`);
      for (const { name, sql, checksum } of pending) {
        await client.query(sql);
        await client.query("INSERT INTO palonex_private.schema_migrations (name, checksum) VALUES ($1, $2)", [name, checksum]);
      }
      return pending.map(file => file.name);
    }, pool, 60_000);
    console.log(JSON.stringify({ event: "database.migrations_applied", applied }));
  }
} catch (error) {
  const code = error && typeof error === "object" && "code" in error && typeof error.code === "string" && /^[A-Z0-9]{5}$/.test(error.code)
    ? error.code : undefined;
  console.error(JSON.stringify({ event: "database.migration_failed", phase: mode, code,
    reason: error instanceof Error && (error.message.startsWith("Applied migration") || error.message.startsWith("Another migration")) ? error.message : undefined }));
  process.exitCode = 1;
} finally { await pool.end(); }
