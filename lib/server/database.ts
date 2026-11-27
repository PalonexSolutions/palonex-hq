import "server-only";
import pg, { type PoolClient } from "pg";

const globalDatabase = globalThis as typeof globalThis & { palonexDatabase?: pg.Pool };

export function getDatabase() {
  if (globalDatabase.palonexDatabase) return globalDatabase.palonexDatabase;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required.");
  const max = Number(process.env.DATABASE_POOL_MAX || 3);
  if (!Number.isInteger(max) || max < 1 || max > 20) throw new Error("Invalid database pool size.");
  const pool = new pg.Pool({
    connectionString, max, connectionTimeoutMillis: 4000, idleTimeoutMillis: 10_000,
    query_timeout: 6000, allowExitOnIdle: true,
  });
  pool.on("error", () => console.error(JSON.stringify({ event: "database.idle_connection_error" })));
  globalDatabase.palonexDatabase = pool;
  return pool;
}

export async function transaction<T>(operation: (client: PoolClient) => Promise<T>) {
  const client = await getDatabase().connect();
  let discard = false;
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout = 5000");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try { await client.query("ROLLBACK"); }
    catch { discard = true; }
    throw error;
  } finally { client.release(discard); }
}
