import { getDatabase } from "@/lib/server/database";
import { handleError, json } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await getDatabase().query("SELECT 1 FROM palonex_private.enquiries LIMIT 0");
    return json({ status: "ok" });
  } catch (error) { return handleError("database.health_failed", error); }
}
