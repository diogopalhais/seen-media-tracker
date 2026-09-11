## Why

I want one place to record the movies and TV series I watch, rate them, and let my personal website show what I've seen most recently. Existing trackers (Letterboxd, Trakt, TV Time) are either film-only, ad-supported, or expose my data only through third-party accounts and rate-limited APIs. Building a small, self-hosted tracker gives me full ownership of the data, a phone-friendly app I can install from the home screen, and a public read-only endpoint my website can call directly. Nothing exists yet, so this change bootstraps the whole product as a greenfield MVP.

## What Changes

- Create a new monorepo `seen` (working name, from the directory `seen-media-tracker`) containing a web frontend, an HTTP API, and a shared contracts package.
- Add **owner authentication**: a single pre-provisioned owner account, password login, revocable bearer session tokens, no self-registration.
- Add **media search** backed by The Movie Database (TMDB): search movies and TV series by title, show posters and release years, and import the selected title into the library.
- Add a **media library** with **watch logging**: each title can have one or more watch entries (date watched, optional season for TV, integer rating from 1 to 10, optional note). Rewatches are supported; the latest rating is the title's displayed rating. Entries can be edited and deleted.
- Add a **public recent-media API**: an unauthenticated, cacheable, CORS-open JSON endpoint returning the N most recently watched titles with poster, title, type, rating and watched date, for embedding in my personal website.
- Add a **web app shell** designed to Apple's Human Interface Guidelines: tab bar navigation, large titles, grouped inset lists, sheet-based modals, system font stack, system colours with light/dark mode, safe-area awareness and 44pt minimum touch targets.
- Make the frontend **installable as a PWA** (web app manifest, service worker with offline app shell, iOS home-screen metadata, install guidance for Safari which has no install prompt).
- Add **API foundation** behaviour: versioned `/api/v1` routes, consistent JSON error shape, health endpoint, CORS allowlist for the app origin, rate limiting on login and public endpoints, request validation.
- Add deployment scaffolding: Cloudflare Pages build for the frontend, a Dockerfile for the API plus a Docker Compose stack (API and PostgreSQL with a persistent data volume) deployed through Coolify on the existing Hetzner server, a development compose file for running the database locally, and GitHub Actions CI for lint, typecheck, tests and build.

Non-goals for this MVP (recorded so they are not accidentally built): multi-user accounts, social features, a "want to watch" watchlist, per-episode tracking, import from Letterboxd/Trakt, push notifications, native iOS/Android builds, image hosting of posters (TMDB image CDN is used directly).

## Capabilities

### New Capabilities

- `auth`: Owner login and logout, session token issuance and revocation, protection of private endpoints, brute-force mitigation on login.
- `media-search`: Searching TMDB for movies and TV series, normalising results, and selecting a result to add to the library.
- `media-library`: Library items, watch entries (log, edit, delete), ratings, watch history and library browsing/sorting.
- `public-recent-api`: Public, unauthenticated, cacheable endpoint exposing recently watched titles for external consumption.
- `web-app-shell`: Navigation structure, HIG-aligned visual system, light/dark appearance, accessibility and responsive behaviour of the frontend.
- `pwa-installability`: Web app manifest, service worker caching strategy, offline behaviour, and iOS/Android install experience.
- `api-foundation`: Cross-cutting API behaviour: versioning, error format, validation, health check, CORS and rate limiting.

### Modified Capabilities

None. There are no existing specs; this change creates the initial set.

## Impact

- **New code**: everything. Proposed layout is a pnpm workspace with `apps/web` (React + Vite + TypeScript PWA), `apps/api` (Node.js + TypeScript HTTP API backed by PostgreSQL), `packages/shared` (Zod schemas and TypeScript types shared by both), plus `.github/workflows` for CI.
- **External dependencies**: TMDB API (requires a free API read-access token; TMDB attribution is required by its terms), Cloudflare Pages (frontend hosting), Coolify on the existing Hetzner server (API hosting with HTTPS via Coolify's Traefik), a personal domain for stable frontend and API hostnames.
- **Data**: a PostgreSQL database running as a second Compose service next to the API, with its data directory on a persistent volume. Loss of the volume means loss of the library; backups are the owner's responsibility and are outside MVP scope beyond documenting a `pg_dump` procedure.
- **Secrets/config**: TMDB token, owner password hash, allowed CORS origins and the database connection URL are supplied as environment variables to the API; the frontend receives only the public API base URL at build time.
- **Personal website**: gains a new upstream dependency on the public recent-media endpoint. The endpoint is versioned so the website integration does not break when the tracker evolves.
- **Assumptions recorded here because the request left them open**: metadata comes from TMDB; "simple auth" means one owner account with a password and no registration; ratings are whole numbers from 1 to 10 (decided with the owner); TV series are tracked per series with an optional season number rather than per episode; the API is a Node.js service because it shares types and tooling with the frontend.
