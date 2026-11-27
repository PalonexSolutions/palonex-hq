export const tools = [
  { slug: "json", name: "JSON Formatter and Validator", category: "Data", description: "Format, minify and validate JSON with syntax locations." },
  { slug: "csv", name: "JSON ↔ CSV", category: "Data", description: "Convert JSON records and CSV tables with quoted fields and header controls." },
  { slug: "diff", name: "Text Diff", category: "Text", description: "Compare two drafts and inspect added, removed and unchanged lines." },
  { slug: "base64", name: "Base64 Encoder and Decoder", category: "Encoding", description: "Encode Unicode text as Base64 and decode it back to UTF-8." },
  { slug: "url", name: "URL Encoder and Decoder", category: "Encoding", description: "Encode URL components, normalize complete URLs and decode them for display." },
  { slug: "sha256", name: "SHA-256 Hash Generator", category: "Cryptography", description: "Calculate a hexadecimal SHA-256 digest for text or a local file." },
  { slug: "uuid", name: "UUID Generator", category: "Cryptography", description: "Generate and export one or more cryptographically secure UUID v4 identifiers." },
  { slug: "text", name: "Text Utilities", category: "Text", description: "Count, change case, remove duplicate lines and clean up whitespace." },
] as const;

export type ToolSlug = (typeof tools)[number]["slug"];
export function toolPath(slug: ToolSlug) { return `/tools/${slug}`; }
