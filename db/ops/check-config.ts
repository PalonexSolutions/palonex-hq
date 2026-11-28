import { applicationOrigin, deploymentStage, runtimeDatabaseUrl } from "../../lib/server/deployment.ts";

try {
  const stage = deploymentStage();
  if (stage === "local") throw new Error("Set VERCEL_ENV to preview or production for this configuration check.");
  applicationOrigin();
  runtimeDatabaseUrl();
  const names = ["BETTER_AUTH_SECRET", "PUBLIC_AUTH_SECRET", "ENQUIRY_SIGNING_SECRET", "CRON_SECRET"];
  const secrets = names.map(name => process.env[name]);
  if (secrets.some(secret => !secret || secret.length < 32) || new Set(secrets).size !== secrets.length)
    throw new Error("Configure four different secrets of at least 32 characters.");
  if (process.env.MAIL_WORKERS_ENABLED === "true") {
    const mail = ["RESEND_API_KEY", "ENQUIRY_EMAIL_FROM", "ENQUIRY_EMAIL_TO", "IDENTITY_EMAIL_FROM"];
    if (stage === "preview") mail.push("PREVIEW_MAIL_TO");
    if (mail.some(name => !process.env[name])) throw new Error("Complete email settings before enabling workers.");
  }
  const max = Number(process.env.DATABASE_POOL_MAX || 2);
  if (!Number.isInteger(max) || max < 1 || max > 5) throw new Error("Use a hosted DATABASE_POOL_MAX of 1 to 5.");
  console.log(JSON.stringify({ event: "deployment.config_checked", stage, mailEnabled: process.env.MAIL_WORKERS_ENABLED === "true" }));
} catch {
  console.error("Deployment settings failed validation. Review origin, branch pins, connection type, secrets and email settings using the environment matrix.");
  process.exitCode = 1;
}
