# Technical decisions

- Use a modular monolith with Next.js App Router, TypeScript and npm lockfile installs.
- Prerender informational pages. Add client JavaScript for feature interactions as needed.
- Use Tailwind CSS, scoped shared class names, and Lucide icons. Evaluate shadcn/ui when form and dialog primitives are needed. Prefer CSS for the initial transitions.
- Keep the AI products at Concept status until their implementation status changes.
- Use Better Auth for administrator session and credential verification, with CLI-only staff provisioning in the existing private PostgreSQL schema. The public application has no accounts.
- Use database-backed login throttling, explicit origin validation, transactional enquiry audit records and read-only notification monitoring.
- Keep `main` stable. Use focused branches for substantial changes and review staged files before pushing milestones.
