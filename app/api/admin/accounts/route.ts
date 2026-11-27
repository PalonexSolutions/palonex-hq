import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin-auth";
import { checkOrigin } from "@/lib/server/enquiry-security";
import { changeIdentityStatus, identityListing } from "@/lib/server/identity-admin";
import { handleError, HttpError, json, readJson } from "@/lib/server/http";

const status = z.enum(["active", "suspended"]);
const schema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("list"), search: z.string().trim().max(150), page: z.number().int().min(1).max(400) }),
  z.strictObject({ action: z.literal("status"), id: z.uuid(), from: status, to: status }),
]);

export async function POST(request: Request) {
  try {
    const actor = await requireAdmin(request.headers);
    checkOrigin(request);
    const parsed = schema.safeParse(await readJson(request, 5000));
    if (!parsed.success) throw new HttpError(400, "Check the account or search fields.");
    const input = parsed.data;
    if (input.action === "list") return json(await identityListing(input.search, input.page));
    await changeIdentityStatus(actor.id, input.id, input.from, input.to);
    return json({ ok: true });
  } catch (error) { return handleError("admin.accounts_failed", error); }
}
