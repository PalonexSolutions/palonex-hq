import { checkSize } from "./input.ts";

export function convertBase64(input: string, mode: "encode" | "decode") {
  checkSize(input, mode === "decode" ? 2_000_000 : undefined);
  if (mode === "encode") {
    const bytes = new TextEncoder().encode(input);
    const chunks: string[] = [];
    for (let start = 0; start < bytes.length; start += 8192) {
      chunks.push(String.fromCharCode(...bytes.subarray(start, start + 8192)));
    }
    return btoa(chunks.join(""));
  }
  const clean = input.replace(/[\t\n\f\r ]/g, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean) || clean.length % 4 === 1 || (clean.includes("=") && clean.length % 4 !== 0)) {
    throw new Error("Enter valid standard Base64. URL-safe Base64 uses a different alphabet.");
  }
  const binary = atob(clean);
  if (btoa(binary).replace(/=+$/, "") !== clean.replace(/=+$/, "")) throw new Error("Invalid Base64 padding bits.");
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(Uint8Array.from(binary, char => char.charCodeAt(0)));
  } catch { throw new Error("The decoded bytes are not valid UTF-8 text."); }
}

export type UrlMode = "encode-component" | "decode-component" | "normalize-url" | "decode-url";
export function convertUrl(input: string, mode: UrlMode) {
  checkSize(input);
  try {
    if (mode === "encode-component") return encodeURIComponent(input);
    if (mode === "decode-component") return decodeURIComponent(input);
    const source = input.trim();
    if (!/^https?:\/\//i.test(source)) throw new Error("Enter an absolute HTTP or HTTPS URL.");
    if (/%(?![0-9a-f]{2})/i.test(source)) throw new Error("The URL contains an invalid percent escape.");
    const url = new URL(source);
    return mode === "decode-url" ? decodeURI(url.href) : url.href;
  } catch (error) {
    if (error instanceof URIError) throw new Error("The input contains a malformed escape or Unicode sequence.");
    if (error instanceof TypeError) throw new Error("Enter a valid absolute HTTP or HTTPS URL.");
    throw error;
  }
}
