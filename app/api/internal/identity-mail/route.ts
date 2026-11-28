import { handleError, HttpError, json } from "@/lib/server/http";
import { deliverIdentityMail } from "@/lib/server/identity-mail";
import { authorizeWorker, workerProvider } from "@/lib/server/worker";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  try {
    if (!authorizeWorker(request)) return json({ status: "paused" });
    const from = process.env.IDENTITY_EMAIL_FROM;
    if (!from) throw new HttpError(503, "Identity email is not configured.");
    const summary = await deliverIdentityMail(workerProvider(), from);
    console.info(JSON.stringify({ event: "identity.mail_run_completed", ...summary }));
    return json(summary);
  } catch (error) { return handleError("identity.mail_worker_failed", error); }
}
