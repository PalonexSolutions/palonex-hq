import { loginSchema } from "@/features/admin/schema";
import { enabledStaff, getAdminAuth, limitLogin, requireAdmin } from "@/lib/server/admin-auth";
import { getDatabase } from "@/lib/server/database";
import { checkOrigin } from "@/lib/server/enquiry-security";
import { handleError, HttpError, json, readJson } from "@/lib/server/http";

function cookieResponse(response: Response) {
  const result = json({ ok: true });
  for (const cookie of response.headers.getSetCookie()) result.headers.append("Set-Cookie", cookie);
  return result;
}

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const parsed = loginSchema.safeParse(await readJson(request, 4096));
    if (!parsed.success) throw new HttpError(400, "Enter a valid email and password.");
    const { email, password } = parsed.data;
    await limitLogin(request, email);
    const response = await getAdminAuth().api.signInEmail({ body: { email, password }, headers: request.headers, asResponse: true });
    if (response.status >= 500) throw new Error("Authentication unavailable.");
    if (!response.ok) throw new HttpError(401, "Invalid email or password.");
    const result = await response.json() as { user: { id: string }; token: string };
    if (!await enabledStaff(result.user.id)) {
      await getDatabase().query("DELETE FROM palonex_private.admin_session WHERE token=$1", [result.token]);
      throw new HttpError(401, "Invalid email or password.");
    }
    return cookieResponse(response);
  } catch (error) { return handleError("admin.login_failed", error); }
}

export async function DELETE(request: Request) {
  try {
    checkOrigin(request);
    const actor = await requireAdmin(request.headers);
    await getDatabase().query("DELETE FROM palonex_private.admin_session WHERE id=$1", [actor.sessionId]);
    const response = await getAdminAuth().api.signOut({ headers: request.headers, asResponse: true });
    if (!response.ok) throw new Error("Unable to clear session cookie.");
    return cookieResponse(response);
  } catch (error) { return handleError("admin.logout_failed", error); }
}
