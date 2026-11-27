export class HttpError extends Error {
  readonly status: number;
  readonly retryAfter?: number;

  constructor(status: number, message: string, retryAfter?: number) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export function json(body: object, status = 200, headers?: HeadersInit) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export function handleError(event: string, error: unknown) {
  if (error instanceof HttpError) {
    if (error.status === 429 || (error.status === 401 && (event === "admin.login_failed" || event === "identity.request_failed"))
      || error.status === 503) {
      console.warn(JSON.stringify({ event, status: error.status }));
    }
    return json({ error: error.message }, error.status, error.retryAfter ? { "Retry-After": String(error.retryAfter) } : undefined);
  }
  console.error(JSON.stringify({ event, outcome: "unavailable" }));
  return json({ error: "Service temporarily unavailable. Please try again." }, 503);
}

export async function readJson(request: Request, maxBytes: number): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new HttpError(415, "Use application/json.");
  }
  if (Number(request.headers.get("content-length")) > maxBytes) throw new HttpError(413, "Request is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Request body is missing.");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let text = "";
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new HttpError(413, "Request is too large.");
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "Request body must contain valid JSON.");
  } finally { reader.releaseLock(); }
}
