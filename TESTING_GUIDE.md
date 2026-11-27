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
