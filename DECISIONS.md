# Technical decisions

- Use a modular monolith with Next.js App Router, TypeScript and npm lockfile installs.
- Prerender informational pages. Add client JavaScript for feature interactions as needed.
- Use Tailwind CSS, scoped shared class names, and Lucide icons. Evaluate shadcn/ui when form and dialog primitives are needed. Prefer CSS for the initial transitions.
- Keep the AI products at Concept status until their implementation status changes.
- Defer account and database integrations until the public experience and required backend configuration are available.
- Keep `main` stable. Use focused branches for substantial changes and review staged files before pushing milestones.
