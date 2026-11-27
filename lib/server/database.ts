import "server-only";
import pg, { type PoolClient } from "pg";
import { deploymentStage, operatorDatabaseUrl, runtimeDatabaseUrl } from "./deployment.ts";

const globalDatabase = globalThis as typeof globalThis & { palonexDatabase?: pg.Pool };

export function getDatabase() {
  if (globalDatabase.palonexDatabase) return globalDatabase.palonexDatabase;
  const connectionString = runtimeDatabaseUrl();
  const stage = deploymentStage();
  const max = Number(process.env.DATABASE_POOL_MAX || (stage === "local" ? 3 : 2));
  if (!Number.isInteger(max) || max < 1 || max > (stage === "local" ? 20 : 5)) throw new Error("Invalid database pool size.");
  const pool = new pg.Pool({
    connectionString, max, enableChannelBinding: true, connectionTimeoutMillis: 4000, idleTimeoutMillis: 5000,
    query_timeout: 6000, allowExitOnIdle: true,
  });
  pool.on("error", () => console.error(JSON.stringify({ event: "database.idle_connection_error" })));
  globalDatabase.palonexDatabase = pool;
  return pool;
}

export function operatorDatabase() {
  return new pg.Pool({
    connectionString: operatorDatabaseUrl(), max: 1, enableChannelBinding: true, connectionTimeoutMillis: 8000,
    query_timeout: 65_000, allowExitOnIdle: true,
  });
}

export async function transaction<T>(operation: (client: PoolClient) => Promise<T>, pool = getDatabase(), timeoutMs = 5000) {
  const client = await pool.connect();
  let discard = false;
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('statement_timeout', $1, true)", [String(timeoutMs)]);
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try { await client.query("ROLLBACK"); }
    catch { discard = true; }
    throw error;
  } finally { client.release(discard); }
}
