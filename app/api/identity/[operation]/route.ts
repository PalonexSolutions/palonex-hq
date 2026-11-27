import { z } from "zod";
import { consentVersion, forms } from "@/features/identity/schema";
import { checkOrigin } from "@/lib/server/enquiry-security";
import { getDatabase } from "@/lib/server/database";
import { currentIdentity, identityAuth, limitIdentity, requireIdentity } from "@/lib/server/identity-auth";
import { consumeIdentityLink } from "@/lib/server/identity-mail";
import { handleError, HttpError, json, readJson } from "@/lib/server/http";

type Props = { params: Promise<{ operation: string }> };

function parse<T>(schema: z.ZodType<T>, payload: unknown): T {
  const parsed = schema.safeParse(payload);
  if (parsed.success) return parsed.data;
  const message = parsed.error.issues.find(issue => issue.path.includes("password") || issue.path.length === 0)?.message;
  throw new HttpError(400, message ?? "Check your details and try again.");
}

function checked(response: Response, message: string, status = 400) {
  if (response.status >= 500) throw new Error("Authentication failed.");
  if (!response.ok) throw new HttpError(status, message);
  return response;
}

function cookies(response: Response) {
  const result = json({ ok: true });
  for (const value of response.headers.getSetCookie()) result.headers.append("Set-Cookie", value);
  return result;
}

export async function GET(request: Request, { params }: Props) {
  if ((await params).operation !== "session") return json({ error: "Not found." }, 404);
  try {
    const session = await currentIdentity(request.headers);
    return json({ authenticated: !!session });
  } catch {
    return json({ authenticated: false });
  }
}

export async function POST(request: Request, { params }: Props) {
  try {
    checkOrigin(request);
    const { operation } = await params;
    const auth = identityAuth().api;
    const headers = request.headers;

    if (operation === "logout") {
      const user = await requireIdentity(headers);
      await getDatabase().query("DELETE FROM palonex_private.identity_session WHERE id=$1 AND \"userId\"=$2", [user.sessionId, user.id]);
      return cookies(checked(await auth.signOut({ headers, asResponse: true }), "Sign-out could not be completed."));
    }
    const payload = await readJson(request, 6500);
    if (operation === "register") {
      const { name, email, password } = parse(forms.register, payload);
      await limitIdentity(request, operation, email);
      const response = await auth.signUpEmail({ body: { name, email, password, consentVersion, consentedAt: new Date() }, headers, asResponse: true });
      if (!response.ok) {
        // A concurrent sign-up may have won the unique email race.
        if (response.status !== 422 || !(await getDatabase().query("SELECT 1 FROM palonex_private.identity_user WHERE email=$1", [email])).rowCount)
          throw new Error("Registration failed.");
      }
      checked(await auth.sendVerificationEmail({ body: { email }, asResponse: true }), "Verification could not be queued.");
      return json({ ok: true }, 202);
    }
    if (operation === "login") {
      const body = parse(forms.login, payload);
      await limitIdentity(request, operation, body.email);
      const response = await auth.signInEmail({ body, headers, asResponse: true });
      if (response.status === 403) throw new HttpError(403, "Verify your email before signing in. You can request another link.");
      checked(response, "Invalid email or password.", 401);
      const { user, token } = await response.json() as { user: { id: string }; token: string };
      const { rowCount } = await getDatabase().query(
        'SELECT 1 FROM palonex_private.identity_user WHERE id=$1 AND status=\'active\' AND "emailVerified"', [user.id]);
      if (!rowCount) {
        await getDatabase().query("DELETE FROM palonex_private.identity_session WHERE token=$1", [token]);
        throw new HttpError(401, "Invalid email or password.");
      }
      return cookies(response);
    }
    if (operation === "resend" || operation === "forgot") {
      const { email } = parse(forms[operation], payload);
      await limitIdentity(request, operation, email);
      const start = Date.now();
      const response = operation === "resend"
        ? await auth.sendVerificationEmail({ body: { email }, asResponse: true })
        : await auth.requestPasswordReset({ body: { email }, asResponse: true });
      if (operation === "forgot") await new Promise(resolve => setTimeout(resolve, Math.max(0, 500 - (Date.now() - start))));
      checked(response, "The request could not be completed.");
      return json({ ok: true }, 202);
    }
    if (operation === "verify" || operation === "reset") {
      const input = operation === "verify" ? parse(forms.verify, payload) : parse(forms.reset, payload);
      await limitIdentity(request, operation, input.link);
      const token = await consumeIdentityLink(operation, input.link);
      const response = "password" in input && typeof input.password === "string"
        ? await auth.resetPassword({ body: { token, newPassword: input.password }, asResponse: true })
        : await auth.verifyEmail({ query: { token }, asResponse: true });
      checked(response, "This link is invalid, expired or already used. Request a new link.");
      return json({ ok: true });
    }
    if (operation === "profile" || operation === "password") {
      const user = await requireIdentity(headers);
      await limitIdentity(request, operation, user.id);
      if (operation === "profile") {
        const { name } = parse(forms.profile, payload);
        await getDatabase().query('UPDATE palonex_private.identity_user SET name=$2,"updatedAt"=now() WHERE id=$1 AND status=\'active\'', [user.id, name]);
        return json({ ok: true });
      }
      const { currentPassword, password } = parse(forms.password, payload);
      return cookies(checked(await auth.changePassword({
        headers, body: { currentPassword, newPassword: password, revokeOtherSessions: true }, asResponse: true,
      }), "Check your current password and try again."));
    }
    return json({ error: "Not found." }, 404);
  } catch (error) { return handleError("identity.request_failed", error); }
}
