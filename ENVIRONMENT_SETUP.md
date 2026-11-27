# Environment setup

Use Node 24. The version used for the initial foundation is recorded in `.nvmrc`. Run `npm ci` followed by `npm run dev`. Use `npm run dev -- --hostname 0.0.0.0` for cloud previews.

If the workspace permits writes only below the checkout and /tmp, use `npm ci --cache /tmp/palonex-npm-cache`.

The public foundation runs without runtime variables. See `.env.example`. Keep future private values in the environment or in a local ignored `.env.local`.
