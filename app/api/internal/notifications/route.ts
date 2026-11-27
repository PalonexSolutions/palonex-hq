import { equalSecret } from "@/lib/server/enquiry-security";
import { handleError, HttpError, json } from "@/lib/server/http";
import { deliverNotifications, resendProvider } from "@/lib/server/notifications";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret || secret.length < 32 || !equalSecret(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
      throw new HttpError(401, "Unauthorized.");
    }
    const { RESEND_API_KEY, ENQUIRY_EMAIL_FROM, ENQUIRY_EMAIL_TO } = process.env;
    if (!RESEND_API_KEY || !ENQUIRY_EMAIL_FROM || !ENQUIRY_EMAIL_TO) {
      throw new HttpError(503, "Notifications are not configured.");
    }
    return json(await deliverNotifications(resendProvider(RESEND_API_KEY), { from: ENQUIRY_EMAIL_FROM, companyTo: ENQUIRY_EMAIL_TO }));
  } catch (error) { return handleError("notifications.run_failed", error); }
}
