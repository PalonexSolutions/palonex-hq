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
