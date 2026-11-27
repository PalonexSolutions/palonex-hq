import { enquirySchema } from "@/features/enquiries/schema";
import { checkOrigin, checkToken, issueToken, minimumSubmissionMs, rateKeys } from "@/lib/server/enquiry-security";
import { handleError, HttpError, json, readJson } from "@/lib/server/http";
import { saveEnquiry } from "@/lib/server/enquiries";

export const runtime = "nodejs";

export function GET() {
  try {
    return json({ token: issueToken(), minimumWaitMs: minimumSubmissionMs });
  } catch (error) { return handleError("enquiry.form_unavailable", error); }
}

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const payload = await readJson(request, 36_000);
    if (payload && typeof payload === "object" && "website" in payload && payload.website !== "") {
      throw new HttpError(400, "Unable to accept this submission.");
    }
    const parsed = enquirySchema.safeParse(payload);
    if (!parsed.success) {
      return json({
        error: "Check the highlighted fields and try again.",
        fields: Object.fromEntries(parsed.error.issues.filter(issue => typeof issue.path[0] === "string")
          .map(issue => [issue.path[0], issue.message])),
      }, 422);
    }
    const input = parsed.data;
    const submissionId = checkToken(input.token);
    const result = await saveEnquiry(submissionId, input, rateKeys(request, input.email));
    if (!result.duplicate) console.info(JSON.stringify({ event: "enquiry.received", id: result.id }));
    return json({ id: result.id }, result.duplicate ? 200 : 201);
  } catch (error) { return handleError("enquiry.submit_failed", error); }
}
