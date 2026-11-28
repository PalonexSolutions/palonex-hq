import { handleError, HttpError, json } from "@/lib/server/http";
import { deliverNotifications } from "@/lib/server/notifications";
import { authorizeWorker, workerProvider } from "@/lib/server/worker";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  try {
    if (!authorizeWorker(request)) return json({ status: "paused" });
    const { ENQUIRY_EMAIL_FROM, ENQUIRY_EMAIL_TO } = process.env;
    if (!ENQUIRY_EMAIL_FROM || !ENQUIRY_EMAIL_TO) throw new HttpError(503, "Notifications are not configured.");
    const summary = await deliverNotifications(workerProvider(), { from: ENQUIRY_EMAIL_FROM, companyTo: ENQUIRY_EMAIL_TO });
    console.info(JSON.stringify({ event: "notifications.run_completed", ...summary }));
    return json(summary);
  } catch (error) { return handleError("notifications.run_failed", error); }
}
