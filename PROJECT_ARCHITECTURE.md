# Project architecture

PaLoNex HQ is an independently deployable Next.js App Router application. Its public informational pages are server components and can be prerendered. The root layout owns navigation and the footer. Product content lives in a typed feature module.

| Directory | Responsibility |
| --- | --- |
| app | Routes, layouts, metadata, shared styles |
| components | Shared presentation and navigation |
| features | Content and feature-specific logic |
| public | Optimized brand artwork |
| tests | Desktop and mobile browser scenarios |

Keep interactive engineering tools in isolated client components. Add enquiry validation and storage behind a server-only boundary. Use Supabase PostgreSQL for persisted enquiries once configured. Future administration will require Supabase Auth and authorization checks at the server and database boundaries. InternHub, Connect and the AI SuperApp can integrate through explicit interfaces as those products mature.

## Engineering Tools

The `/tools` directory and eight tool routes are prerendered from the typed catalog in `features/tools/catalog.ts`. The directory filters in the browser. Each route selects a client workspace. Converters share input, output, preferences and feedback controls. Diff, text statistics, hashing and UUIDs use dedicated interfaces.

Processing modules have no React dependency. `data.ts` validates JSON and tokenizes its existing text for whitespace-only formatting, then separately handles quoted CSV records. `encoding.ts` uses browser-native URL and UTF-8 operations. `text.ts` compares lines with a bounded longest-common-subsequence calculation and uses Intl segmentation for language-aware counts. `crypto.ts` uses Web Crypto for hashing and UUID generation.

Add a tool by extending the catalog, adding an independently testable processing module and selecting its workspace in the route. Reuse feedback and output actions where appropriate. The sitemap and static route list come from the catalog.

Inputs, files and results live in browser memory while a workspace is open. The app makes no processing or upload requests and keeps no input history. Copy and download occur only on user action. The existing theme preference continues to use local storage.

### Limits

- Most text input limits are 500,000 UTF-16 code units. Base64 accepts up to 2,000,000 code units for decoding so maximum-sized UTF-8 inputs can round-trip. Expanded data outputs are bounded.
- Diff compares up to 10,000 lines and 250,000 code units per side. It rejects changed regions that exceed its work budget and paginates visible output.
- CSV header detection is heuristic. Override it for ambiguous data. CSV-to-JSON preserves cells as strings. JSON-to-CSV follows native JSON number precision and serializes nested values as JSON text. Spreadsheet applications can interpret formula-like cells, so import untrusted exports as text.
- Full URL normalization follows browser URL semantics. Full URL decoding is for display, since a decoded space or character may need encoding before reuse.
- File hashing reads up to 32 MiB into memory and requires Web Crypto in a secure context. Clipboard operations depend on browser permissions. UUID batches contain up to 100 identifiers.
