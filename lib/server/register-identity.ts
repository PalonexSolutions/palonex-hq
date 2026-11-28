import "server-only";
import { consentVersion, forms } from "../../features/identity/schema.ts";
import { checkOrigin } from "./enquiry-security.ts";
import { getDatabase } from "./database.ts";
import { identityAuth, limitIdentity } from "./identity-auth.ts";
import { identityConfig } from "./identity-config.ts";
import { HttpError, json, readJson } from "./http.ts";
import { diagnoseRegistration } from "./registration-diagnostics.ts";

export function registerIdentity(request: Request) {
  return diagnoseRegistration(async (next, authStatus) => {
    checkOrigin(request);
    next("request_validation");
    const parsed = forms.register.safeParse(await readJson(request, 6500));
    if (!parsed.success) {
      const issue = parsed.error.issues.find(item =>
        item.code !== "unrecognized_keys" && (item.path.includes("password") || item.path.length === 0));
      throw new HttpError(400, issue?.message ?? "Check your details and try again.");
    }
    const { name, email, password } = parsed.data;

    next("auth_initialization");
    const config = identityConfig();
    next("database_initialization");
    const pool = getDatabase();
    next("auth_initialization");
    const auth = identityAuth(config, pool).api;

    next("rate_limit");
    await limitIdentity(request, "register", email);

    next("signup");
    const response = await auth.signUpEmail({
      body: { name, email, password, consentVersion, consentedAt: new Date() },
      headers: request.headers, asResponse: true,
    });
    if (!response.ok) {
      authStatus(response.status);
      if (response.status !== 422) throw new Error("Registration failed.");
      let exists;
      try {
        // A concurrent sign-up may have committed before this request hit the unique constraint.
        exists = (await pool.query("SELECT 1 FROM palonex_private.identity_user WHERE email=$1", [email])).rowCount;
      } catch (error) {
        next("duplicate_check");
        authStatus(response.status);
        throw error;
      }
      if (!exists) throw new Error("Registration failed.");
    }

    next("verification_queue");
    const verification = await auth.sendVerificationEmail({ body: { email }, asResponse: true });
    if (!verification.ok) {
      authStatus(verification.status);
      if (verification.status >= 500) throw new Error("Verification could not be queued.");
      throw new HttpError(400, "Verification could not be queued.");
    }
    return json({ ok: true }, 202);
  });
}
