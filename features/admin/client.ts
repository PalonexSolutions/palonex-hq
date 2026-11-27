"use client";

export async function adminRequest<T>(path: string, method: string, body?: object): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method, headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch { throw new Error("A connection error occurred. Please try again."); }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error ?? "The operation could not be completed.");
  return data as T;
}
