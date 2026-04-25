# SOS Proxy

Next.js application for fetching, checking, and displaying Telegram MTProto proxies.

## Scripts

- `npm run dev` starts the Next development server.
- `npm run build` creates a production build.
- `npm run start` serves the production build.
- `npm run lint` runs ESLint.
- `npm run typecheck` runs TypeScript without emitting files.

## Structure

- `pages/index.tsx` renders the proxy dashboard.
- `pages/api/*.ts` exposes the fetch and health-check API routes.
- `styles/` contains global and page-level CSS used by the Next app.
