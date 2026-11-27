import { equalSecret } from "@/lib/server/enquiry-security";
import { handleError, HttpError, json } from "@/lib/server/http";
import { deliverIdentityMail } from "@/lib/server/identity-mail";
import { resendProvider } from "@/lib/server/notifications";

export const maxDuration = 30;

export async function GET(request: Request) {
  try {
    const { CRON_SECRET, RESEND_API_KEY, IDENTITY_EMAIL_FROM } = process.env;
    if (!CRON_SECRET || CRON_SECRET.length < 32 || !equalSecret(request.headers.get("authorization") ?? "", `Bearer ${CRON_SECRET}`))
      throw new HttpError(401, "Unauthorized.");
    if (!RESEND_API_KEY || !IDENTITY_EMAIL_FROM) throw new HttpError(503, "Identity email is not configured.");
    return json(await deliverIdentityMail(resendProvider(RESEND_API_KEY), IDENTITY_EMAIL_FROM));
  } catch (error) { return handleError("identity.mail_worker_failed", error); }
}
