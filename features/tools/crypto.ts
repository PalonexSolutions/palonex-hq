import { checkSize } from "./input.ts";

export const fileLimit = 32 * 1024 * 1024;

export async function hashSha256(input: string | Blob) {
  if (!globalThis.crypto?.subtle) throw new Error("SHA-256 requires a secure browser context, such as HTTPS or localhost.");
  if (typeof input === "string") checkSize(input);
  else if (input.size > fileLimit) throw new Error("Choose a file no larger than 32 MiB.");
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : await input.arrayBuffer();
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

export function generateUuids(count: number) {
  if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error("Enter a whole number from 1 to 100.");
  if (!globalThis.crypto?.getRandomValues) throw new Error("Secure random generation is unavailable in this browser.");
  return Array.from({ length: count }, () => {
    if (globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID();
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  });
}
