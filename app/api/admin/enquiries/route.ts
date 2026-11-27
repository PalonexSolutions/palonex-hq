import { adminListSchema } from "@/features/admin/schema";
import { requireAdmin } from "@/lib/server/admin-auth";
import { checkOrigin } from "@/lib/server/enquiry-security";
import { listEnquiries } from "@/lib/server/enquiries";
import { handleError, HttpError, json, readJson } from "@/lib/server/http";

export async function POST(request: Request) {
  try {
    await requireAdmin(request.headers);
    checkOrigin(request);
    const parsed = adminListSchema.safeParse(await readJson(request, 4096));
    if (!parsed.success) throw new HttpError(400, "Invalid enquiry filters or page cursor.");
    return json(await listEnquiries(parsed.data));
  } catch (error) { return handleError("admin.enquiries_failed", error); }
}
