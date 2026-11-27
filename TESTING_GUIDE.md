# Testing guide

Run the following from the repository root.

```sh
npm run lint
npm run typecheck
npm run build
npx playwright install chromium
npm test
```

Playwright starts the production build on port 3100 and tests desktop Chrome and a mobile viewport. If Chromium is already installed, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to its path before running the suite. The current cases cover the homepage, ecosystem link, mobile overflow, product navigation and the enquiry section.

Run `npm run test:unit` on Node 24 for the standalone processing suite. It exercises malformed, empty, Unicode, boundary and large inputs across all eight tools. The Playwright suite exercises the actual workspaces, including local file hashing, downloads, clipboard, invalid-input feedback, accessible labels, keyboard activation and mobile navigation.
