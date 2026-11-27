import "server-only";
import { z } from "zod";
import { deploymentStage, type Environment } from "./deployment.ts";
import { equalSecret } from "./enquiry-security.ts";
import { HttpError } from "./http.ts";
import { resendProvider, type MailProvider } from "./notifications.ts";

export function authorizeWorker(request: Request, env: Environment = process.env) {
  const secret = env.CRON_SECRET;
  if (!secret || secret.length < 32 || !equalSecret(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    throw new HttpError(401, "Unauthorized.");
  }
  return env.MAIL_WORKERS_ENABLED === "true";
}

export function restrictPreviewMail(provider: MailProvider, env: Environment = process.env): MailProvider {
  if (deploymentStage(env) !== "preview") return provider;
  const allowed = z.email().safeParse(env.PREVIEW_MAIL_TO);
  if (!allowed.success) throw new HttpError(503, "Preview mail requires an approved recipient.");
  const recipient = allowed.data.toLowerCase();
  return {
    async send(message, key) {
      if (message.to.toLowerCase() !== recipient) throw new Error("Preview recipient blocked.");
      await provider.send(message, key);
    },
  };
}

export function workerProvider() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new HttpError(503, "Mail provider is not configured.");
  return restrictPreviewMail(resendProvider(apiKey));
}
