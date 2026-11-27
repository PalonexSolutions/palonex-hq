import { z } from "zod";
import { enquiryChange } from "@/features/admin/schema";
import { requireAdmin } from "@/lib/server/admin-auth";
import { changeEnquiry } from "@/lib/server/admin-enquiries";
import { checkOrigin } from "@/lib/server/enquiry-security";
import { handleError, HttpError, json, readJson } from "@/lib/server/http";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdmin(request.headers);
    checkOrigin(request);
    const id = z.uuid().safeParse((await params).id);
    if (!id.success) throw new HttpError(404, "Enquiry not found.");
    const parsed = enquiryChange.safeParse(await readJson(request, 12_500));
    if (!parsed.success) throw new HttpError(400, "Enter a valid status or a note of up to 2,000 characters.");
    await changeEnquiry(actor.id, id.data, parsed.data);
    return json({ ok: true });
  } catch (error) { return handleError("admin.enquiry_change_failed", error); }
}
