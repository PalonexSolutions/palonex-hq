import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { ConfigurationError } from "./deployment.ts";
import { HttpError, json } from "./http.ts";

type Stage = "origin_validation" | "request_validation" | "auth_initialization" | "database_initialization"
  | "rate_limit" | "signup" | "duplicate_check" | "verification_queue";
const names = new Set(["Error", "TypeError", "RangeError", "SyntaxError", "APIError", "BetterAuthError"]);
const connectionCodes = new Set(["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "CERT_HAS_EXPIRED", "ERR_TLS_CERT_ALTNAME_INVALID"]);

function safeError(error: unknown) {
  if (error instanceof ConfigurationError) return { errorName: "ConfigurationError", configurationIssue: error.issue };
  if (error instanceof HttpError) return { errorName: "HttpError" };
  if (error instanceof Error) {
    if (error instanceof pg.DatabaseError && error.code && /^[0-9A-Z]{5}$/.test(error.code)) {
      return { errorName: "DatabaseError", sqlState: error.code };
    }
    const code = "code" in error ? error.code : undefined;
    return {
      errorName: names.has(error.name) ? error.name : "Error",
      connectionCode: typeof code === "string" && connectionCodes.has(code) ? code : undefined,
    };
  }
  return { errorName: "UnknownError" };
}

const authErrors = new AsyncLocalStorage<{ error?: ReturnType<typeof safeError> }>();

// Better Auth can turn a PostgreSQL error into an opaque HTTP response.
// Collect only safe fields and discard all library messages and raw arguments.
export function captureRegistrationAuthError(...args: unknown[]) {
  const context = authErrors.getStore();
  if (!context) return;
  const error = args.find(arg => arg instanceof pg.DatabaseError) ?? args.find(arg => arg instanceof Error);
  if (error) context.error = safeError(error);
}

export async function diagnoseRegistration(run: (next: (stage: Stage) => void, authStatus: (status: number) => void) => Promise<Response>) {
  const captured: { error?: ReturnType<typeof safeError> } = {};
  const progress: { stage: Stage } = { stage: "origin_validation" };
  let authStatus: number | undefined;
  try {
    return await authErrors.run(captured, () => run(
      next => { progress.stage = next; authStatus = undefined; captured.error = undefined; },
      status => { authStatus = status; },
    ));
  } catch (error) {
    const { stage } = progress;
    const status = error instanceof HttpError ? error.status : 503;
    if (stage !== "request_validation" || status >= 500) {
      console[status >= 500 ? "error" : "warn"](JSON.stringify({
        event: "identity.registration_failed",
        stage, status, requestId: randomUUID(),
        ...safeError(error), ...captured.error, authStatus,
      }));
    }
    return status >= 500
      ? json({ error: "Service temporarily unavailable. Please try again." }, 503)
      : json({ error: (error as HttpError).message }, status,
        error instanceof HttpError && error.retryAfter ? { "Retry-After": String(error.retryAfter) } : undefined);
  }
}
