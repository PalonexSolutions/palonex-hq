# Project architecture

PaLoNex HQ is an independently deployable Next.js App Router application. Its public informational pages are server components and can be prerendered. The root layout owns navigation and the footer. Product content lives in a typed feature module.

| Directory | Responsibility |
| --- | --- |
| app | Routes, layouts, metadata, shared styles |
| components | Shared presentation and navigation |
| features | Content and feature-specific logic |
| public | Optimized brand artwork |
| tests | Desktop and mobile browser scenarios |

Keep interactive engineering tools in isolated client components. The shared backend runs in Next.js Node route handlers. Keep database access and enquiry operations inside server-only modules. InternHub, Connect and the AI SuperApp can integrate through explicit interfaces as those products mature.

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

## Shared backend

Use PostgreSQL with the typed `pg` query API, Zod validation and checked-in SQL migrations. A full ORM would add another schema representation for the current workload. SQL keeps transactions, locking, keyset pagination and outbox leases visible. Query result types are declared at the server boundary and integration-tested against PostgreSQL.

The `palonex_private` schema stores enquiries and consent, hashed rate-limit counters and notification jobs. Creation and enqueue happen atomically. Duplicate submissions are serialized by an advisory transaction lock and verified against an input fingerprint. Status updates use compare-and-set semantics and a transition table. The read service remains server-only and the admin routes require a verified staff session.

Route handlers own HTTP concerns and use centralized request parsing and safe errors. The database pool is reused per warm process. Email delivery happens in a separately scheduled handler using a provider interface and durable leases. No business records are returned to public clients.

Organizations, product data and file storage should use their own modules and migrations. Apply explicit authorization to new administrative capabilities. The current notification boundary can be reused through explicit job and provider interfaces when another product needs it.

See [backend setup](BACKEND_SETUP.md) for configuration, scheduling, retention and operational trade-offs.


## Internal administration

The admin console uses Better Auth credential verification, signed session cookies and PostgreSQL session records in `palonex_private`. Separate staff grants are checked on every protected page and API. The auth library is called server-side and the login route forwards only the session cookie and a generic success response. Staff accounts are provisioned through a maintenance CLI.

The dashboard reads real enquiry and outbox aggregates. Private search uses bounded POST bodies and keyset pagination. Enquiry changes apply the existing transition policy and append audit records in the same transaction. The worker remains separate from the read-only outbox view. See [admin setup](ADMIN_SETUP.md) for environment variables and production privileges.


## Public identity

One public identity directory issues stable UUIDs for future application records. HQ uses the existing Better Auth engine with a distinct public realm so existing staff credentials and sessions remain isolated. Public login requires verified email and active status. Email verification and password recovery use encrypted, single-use links queued in PostgreSQL and delivered through the shared Resend provider. See [identity architecture](IDENTITY_ARCHITECTURE.md) and [user auth setup](USER_AUTH_SETUP.md).


## Hosted deployment

Vercel uses the native Next.js configuration and a pinned, TLS-verified Neon pooled endpoint. Operator commands use separate direct credentials, and migrations never run during builds. Hosted origins are explicit per environment. Both scheduled mail routes are authenticated, opt-in and independently monitored. See the [deployment guide](PRODUCTION_DEPLOYMENT_GUIDE.md) and [operations runbook](PRODUCTION_OPERATIONS_RUNBOOK.md).
