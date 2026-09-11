## Context

Greenfield project; no code exists yet. See proposal.md for motivation. Constraints that shape the design:

- Frontend is static hosting on Cloudflare Pages; the API runs as a Docker container on Coolify on an existing Hetzner server. They will live on **different origins**, so authentication and CORS must work cross-origin, including in Safari on iOS which blocks third-party cookies.
- Single owner, personal scale: tens of writes per week, a few thousand rows over years, one concurrent user plus low public read traffic from the personal website.
- Phone-first, must feel native on iPhone (Human Interface Guidelines), and install to the home screen. iOS has no install prompt and only supports installation from Safari.
- Metadata comes from TMDB, whose API token must not be exposed to browsers and whose terms require attribution.
- Requirements live in `specs/*/spec.md`; this document covers how they are met, not what they are.

## Goals / Non-Goals

**Goals:**
- Smallest operational footprint that is still production-grade: one Compose stack (API container plus PostgreSQL), one static site, deploy on git push.
- One TypeScript language across the stack with request and response contracts shared between API and web so drift is a compile error.
- Every spec scenario cheaply testable: API integration tests against an in-process PostgreSQL and a stubbed TMDB; component tests for the few interactive controls.
- Additive-only v1 public contract so the personal website never breaks.

**Non-Goals:**
- Horizontal scaling, multi-region, or zero-downtime schema migrations.
- Offline write queue or background sync (offline is read-only in the MVP).
- Native wrappers (Capacitor etc.); the PWA is the mobile app.
- Generic multi-tenant auth or an identity provider.

## Decisions

### D1. Monorepo with pnpm workspaces
`apps/web`, `apps/api`, `packages/shared`. Node 22 LTS, TypeScript strict with project references, Biome for lint and format (one tool, fast, no plugin sprawl), Vitest everywhere, `tsx` for API dev reloads.
- *Alternatives*: two repositories (duplicated types, two CI setups); Turborepo/Nx (unnecessary at three packages; can be added later without restructuring).

### D2. Shared contracts package
`packages/shared` holds Zod schemas for every request, response and domain object plus the derived TypeScript types and small pure helpers (rating validation, date validation, TMDB image URL builder). The API validates with these schemas; the web client types its fetch wrapper from them.
- *Alternatives*: OpenAPI-first with generated clients (more tooling for one consumer); tRPC (couples web to API runtime and complicates the public feed for third parties). Zod is the lowest-ceremony way to get one source of truth. An OpenAPI document can still be emitted from the Zod schemas later for documentation.

### D3. Frontend: React 19, Vite, TypeScript, Tailwind CSS v4, React Router, TanStack Query
- **React + Vite**: mainstream, fast builds, first-class PWA plugin.
- **Tailwind v4 with CSS variables**: semantic tokens (`--color-label`, `--color-bg-grouped`, `--color-tint`, ...) map to iOS system palette values for light and dark; Tailwind consumes them via `@theme`. Utilities keep the small hand-built component set consistent without a design-system dependency.
- **React Router (library mode)**: nested routes give per-tab stacks (`/library/*`, `/search/*`, `/settings/*`) and make browser back equal in-app back. Tab state preservation is done by keeping each tab's route tree mounted and toggling visibility, with scroll position stored per tab.
- **TanStack Query**: caching, background refetch, mutation invalidation, and `online`/`offline` awareness. It composes with the service worker's network-first caching rather than duplicating it.
- **Component approach**: hand-crafted primitives (TabBar, NavBar with collapsing large title, InsetGroupedList, Sheet, AlertDialog, SegmentedControl, RatingPicker, SearchField, PosterGrid, Skeleton) built on Radix UI primitives for accessibility (Dialog, AlertDialog, RadioGroup) and `vaul` for the bottom-sheet drawer gesture. Icons from Phosphor, which ships regular and filled weights matching the HIG "filled when selected" tab convention; SF Symbols are not licensed for web use.
- *Alternatives*: Konsta UI or Framework7 (ready-made iOS look, but opinionated, heavier, and harder to align with HIG details and accessibility); Next.js/Remix (SSR is unnecessary for an authenticated single-user app and complicates static Pages hosting); Svelte (fine, but React has the richer accessible-primitive ecosystem needed here).

### D4. HIG concept to web implementation mapping
| HIG concept | Web implementation |
|---|---|
| Tab bar | Fixed bottom `nav` with `backdrop-filter` blur, `padding-bottom: env(safe-area-inset-bottom)`; becomes sidebar at `min-width: 768px` |
| Navigation bar, large title | Sticky header; large title collapses via scroll position (IntersectionObserver sentinel), translucent background when collapsed |
| Sheet | `vaul` Drawer (Radix Dialog underneath) with grabber, swipe-to-dismiss, Escape, focus trap |
| Alert / action sheet | Radix AlertDialog, destructive action styled `--color-destructive`, cancel is default focus |
| Inset grouped list | Rounded container on grouped background, separators inset to text leading edge, 44 px min row |
| Segmented control | Radix RadioGroup styled as iOS segmented control |
| System colours | CSS variables with light values on `:root`, dark under `prefers-color-scheme: dark` and `[data-theme="dark"]` |
| SF Pro / Dynamic Type | `-apple-system, BlinkMacSystemFont, system-ui, ...` stack; rem-based scale mirroring iOS text styles |
| Safe areas | `viewport-fit=cover` plus `env(safe-area-inset-*)` on bars, sheets and root padding |
| Reduce Motion | All transitions gated on `prefers-reduced-motion` |

### D5. PWA via `vite-plugin-pwa` (Workbox)
`registerType: 'prompt'` so the app controls when a new service worker activates: check on launch, activate immediately if the app has not rendered private data yet, otherwise show the update banner. Manifest generated by the plugin. Runtime caching: `CacheFirst` for `image.tmdb.org` (500 entries, 30 days), `NetworkFirst` for private GETs with a 10 s timeout, nothing for non-GET. Cloudflare `_headers` serves `sw.js` and `index.html` with `no-cache` and hashed assets as `immutable`. `_redirects` maps `/* /index.html 200` for deep links.
- *Alternatives*: hand-written service worker (full control, more bugs, no precache manifest generation).

### D6. API: Hono on Node with Zod validation
Hono is small, TypeScript-first, uses Web-standard `Request`/`Response`, has official Zod validator middleware and runs unchanged on Cloudflare Workers if the API ever moves there. Middleware chain: request id, logger, security headers, CORS (two policies: allowlist for `/api/v1/*`, wildcard for `/api/v1/public/*`), body limit, rate limiter, auth (for private routes), error handler producing the standard error shape.
- *Alternatives*: Fastify (mature, but more boilerplate and its own schema world); NestJS (excellent for large teams, heavy for about fifteen endpoints); Express (legacy, no types, no Web standards).

### D7. Storage: PostgreSQL 17 with Drizzle ORM
PostgreSQL runs as the `db` service in the Docker Compose stack next to the API, with its data directory on a named volume and no published port in production. The API connects through `DATABASE_URL` using the `postgres` (postgres.js) driver and Drizzle ORM. Drizzle schema lives in code, `drizzle-kit generate` produces SQL migrations committed to the repository, and pending migrations are applied at process start (forward-only) under a Postgres advisory lock so a restart never runs them twice. Integration tests run against PGlite (in-process WebAssembly Postgres) through Drizzle's PGlite driver, so CI needs no database container and tests stay fast.
- *Why Postgres*: chosen with the owner, who prefers a conventional client/server database and a Compose deployment. SQLite would have sufficed at this scale, but Postgres gives a familiar operational model (`pg_dump`, tooling, future replication) and Coolify handles Compose stacks natively.
- *Alternatives*: SQLite file on a volume (simplest, but a single file with no separate service was not wanted); libSQL/Turso (external dependency for a self-hosted project); Prisma (heavier engine, slower cold start); `pg` driver (fine, but postgres.js is smaller and fully typed).
- *Local development*: `compose.dev.yaml` runs only Postgres with a published port; the API runs on the host with `pnpm dev`.

Tables:
- `media_items`: `id` (uuid, generated), `media_type` (`movie`|`tv`, enum), `tmdb_id` (integer), `title`, `original_title`, `release_year` (integer), `release_date` (date), `poster_path`, `backdrop_path`, `overview`, `genres` (jsonb), `runtime_minutes`, `number_of_seasons`, `created_at`, `updated_at` (timestamptz); unique `(media_type, tmdb_id)`.
- `watch_entries`: `id`, `media_item_id` (FK, cascade delete), `watched_on` (date), `rating` (smallint 1 to 10, nullable, CHECK), `season` (integer, nullable), `note`, `created_at`, `updated_at` (timestamptz); indexes on `(watched_on DESC, created_at DESC)` and `media_item_id`.
- `sessions`: `id`, `token_hash` (unique), `created_at`, `expires_at`, `last_used_at` (timestamptz), `user_agent`.
- `login_attempts` is not a table: login throttling and public rate limits use an in-memory sliding window; a single process makes this sufficient and restart-clearing is acceptable.

Derived values (item rating = latest rated entry, last watched, watch count, public "most recent watch per title") are computed with correlated subqueries or window functions at query time. At personal scale this is simpler and always consistent; a materialised column can be added later if listing ever becomes slow.

Ratings are whole numbers 1 to 10 stored and transmitted as-is; the shared Zod schema enforces the integer range so no conversion layer exists. The web app renders them as a numeric badge (`8/10`) and picks them with a `RatingPicker` of ten numbered buttons (see D3).

### D8. Authentication: single owner, password, opaque bearer sessions
- Owner password is stored as an **argon2id hash** in the `OWNER_PASSWORD_HASH` environment variable, generated with a CLI script in `apps/api` (`pnpm --filter api hash-password`). No user table.
- Login verifies the hash (argon2 verification cost gives a uniform response time for right and wrong passwords), then issues a 32-byte random token encoded base64url. Only its SHA-256 is stored in `sessions` with a 30-day absolute expiry. Middleware hashes the presented token, looks it up, checks expiry and updates `last_used_at` at most once per minute.
- Token transport is `Authorization: Bearer`; the web app keeps it in `localStorage` with an in-memory fallback when storage is unavailable (private mode). A single `401` clears it and routes to `/login`.
- *Why not cookies*: FE and API are different origins; Safari's tracking prevention blocks cross-site cookies unless both hosts share a registrable domain, which is not guaranteed. Bearer tokens work everywhere and let the PWA relaunch without a login. The XSS exposure of `localStorage` is mitigated by a strict Content Security Policy on the Pages site (`default-src 'self'`, images from `image.tmdb.org`, connect to the API origin only), no third-party scripts, revocable sessions and the 30-day expiry.
- *Why not JWT*: revocation on logout needs server state anyway; an opaque token is simpler and smaller.
- *Later*: passkeys (WebAuthn) would fit this single-user model well and could replace the password without changing the session layer.

### D9. TMDB integration server-side only
The API holds the TMDB v4 read token. `type=all` search calls `/search/movie` and `/search/tv` in parallel and merges by TMDB popularity rather than using `/search/multi`, which also returns people. Details use `/movie/{id}` and `/tv/{id}` (the latter includes seasons). Only `poster_path`/`backdrop_path` are stored; full image URLs are composed with the TMDB image base and fixed sizes (`w342` posters, `w780` backdrops) so consumers never depend on TMDB's configuration endpoint. An in-process LRU cache keeps search responses for 5 minutes and details for 1 hour to stay well inside TMDB's rate limits. Provider failures map to `502 upstream_unavailable`. Language is configurable via `TMDB_LANGUAGE` (default `en-US`).

### D10. Public feed caching
The public endpoint computes a strong ETag from a hash of the serialised payload and sets `Cache-Control: public, max-age=300, stale-while-revalidate=600`. If the API hostname is proxied through Cloudflare (orange cloud), the edge respects these headers and absorbs personal-website traffic; this is recommended but not required, so the API's own rate limiter (60 req/min per IP) remains the backstop.

### D11. Web application structure
Routes: `/login`, `/` (redirects to `/library`), `/library`, `/library/:itemId`, `/search`, `/search/:mediaType/:tmdbId`, `/settings`. A root layout mounts the tab bar or sidebar and an auth guard. A typed `apiClient` wraps `fetch`, attaches the bearer token, parses responses with shared schemas and translates the standard error shape into a typed `ApiError`; a `401` triggers logout. Query keys: `['session']`, `['library', filters]`, `['library-item', id]`, `['search', q, type]`, `['title', type, id]`. Mutations invalidate `library*` keys and the affected `title`. Dates default to the device's local calendar date. Appearance override is stored in `localStorage` and applied through a `data-theme` attribute on `<html>`; `theme-color` meta tags are updated to match.

### D12. Configuration and startup
The API validates its environment with a Zod schema at boot and exits with a clear message on failure. Variables: `PORT`, `DATABASE_URL`, `OWNER_PASSWORD_HASH`, `TMDB_API_TOKEN`, `TMDB_LANGUAGE`, `CORS_ORIGINS` (comma-separated), `TRUST_PROXY` (`1` on Coolify, which fronts the container with Traefik), `LOG_LEVEL`. The web build takes only `VITE_API_BASE_URL`. Structured JSON logs (pino) with request ids; graceful shutdown on `SIGTERM` closes the HTTP server and the database pool. The API waits for the database to accept connections (bounded retries) before running migrations and listening, because Compose `depends_on` with a healthcheck covers the first start but not every restart ordering.

### D13. Deployment
- **Web**: Cloudflare Pages connected to the GitHub repository; build command `pnpm install --frozen-lockfile && pnpm --filter web build`, output `apps/web/dist`; `_headers` sets CSP, `X-Frame-Options`, `Referrer-Policy` and cache rules; `_redirects` provides the SPA fallback. Preview deployments per pull request.
- **API and database**: multi-stage Dockerfile for the API (install with pnpm and a lockfile, build shared and api, prune to production deps, final `node:22-alpine` image running as non-root with a `HEALTHCHECK` hitting `/health`). A root `compose.yaml` defines two services: `api` (built from the Dockerfile, `depends_on: db: condition: service_healthy`, environment from Coolify, exposes port 3000 to the proxy only) and `db` (`postgres:17-alpine`, `pgdata` named volume, `pg_isready` healthcheck, credentials from environment, no published port). Coolify application of type Docker Compose pointing at the repository; Coolify attaches the domain `api.seen.<domain>` and the Let's Encrypt certificate to the `api` service and injects environment variables, including `DATABASE_URL` built from the `db` service name. Deploy on push to `main`.
- **CI**: GitHub Actions on pull requests and `main`: install, Biome check, `tsc -b`, Vitest, build both apps, Docker build of the API (no push) and `docker compose config` to validate the Compose file. The Cloudflare and Coolify integrations perform the actual deployments.

### D14. Testing strategy
- `packages/shared`: unit tests for schemas and helpers (rating range and integer rule, date rules).
- `apps/api`: integration tests through Hono's `app.request()` against a PGlite database migrated with the committed SQL with a stubbed TMDB client injected through a small provider interface; each spec scenario maps to a test case (auth flows, throttling, validation, public feed dedup and ETag).
- `apps/web`: Vitest plus Testing Library for `RatingPicker` (tap, keyboard, clear, announcements), login flow, and log-watch sheet validation; manual device checklist for HIG behaviours (collapsing title, sheets, safe areas, dark mode) on a real iPhone in standalone mode. Playwright end-to-end can be added after the MVP.

## Risks / Trade-offs

- [TMDB outage or rate limiting breaks search] → Server-side caching, `502` surfaced as a retryable inline error; the library itself never depends on TMDB after import because metadata is snapshotted.
- [Bearer token in `localStorage` exposed by an XSS bug] → Strict CSP, no third-party scripts, single-user app with revocable 30-day sessions; passkeys are the planned hardening.
- [PostgreSQL data volume on one server is a single point of data loss] → Document a nightly `pg_dump` cron (or Coolify scheduled backup) shipped to object storage or a Hetzner Storage Box; test a restore once before relying on it. Cascade deletes are limited to entry-to-item, never bulk.
- [Two containers instead of one add startup ordering and credential handling] → Compose healthcheck plus bounded connection retries in the API; database credentials only ever live in Coolify environment variables and the Compose file references them by name.
- [iOS PWA limitations: no install prompt, Safari-only installation, no push] → Settings shows explicit Add-to-Home-Screen instructions; features needing push are out of scope. Installed web apps are exempt from Safari's seven-day storage eviction, so sessions persist once installed.
- [Cross-origin misconfiguration silently blocks the app] → `CORS_ORIGINS` validated at boot, an integration test covers preflight, and a smoke check hits `/health` and a preflight after deploy.
- [HIG behaviours like collapsing titles and sheet gestures feel janky on the web] → Keep animations transform/opacity only, respect reduced motion, test on device early (task ordering puts the shell before feature screens).
- [In-memory rate limiting resets on restart and is per-process] → Acceptable for one container; upgrade to a Postgres-backed window if the API is ever replicated.
- [Two deploy pipelines (Pages and Coolify) can drift on contract changes] → Shared package in the same repository, additive-only v1 API, and CI builds both apps from one commit.
- [Ignoring unknown body fields hides client typos] → Shared schemas make the client type-safe, so typos are compile errors rather than runtime drift.

## Migration Plan

Greenfield, so this is a rollout order rather than a migration:
1. Create the repository and CI; land the shared package and API with `/health` and auth only; deploy the Compose stack to Coolify with environment variables set; verify `/health` over HTTPS and that the `pgdata` volume survives a redeploy.
2. Land the web shell with login and deploy to Cloudflare Pages; set `CORS_ORIGINS` to the Pages origin and custom domain; verify login end-to-end on an iPhone.
3. Land search, library and public feed; point the personal website at the public endpoint.
4. Rollback: Coolify redeploys the previous image; Cloudflare Pages rolls back to the previous deployment. Database migrations are forward-only, so take a `pg_dump` before any deploy that includes a migration.

## Open Questions

- Final hostnames (placeholders `seen.<domain>` for the app and `api.seen.<domain>` for the API) and whether the API hostname is proxied through Cloudflare. Either answer fits the design.
- Whether "Seen" stays as the product name; it only affects manifest strings and icons.
- TMDB language and region preference for titles and release dates (default `en-US`).
- Backup destination for `pg_dump` output (Hetzner Storage Box, Cloudflare R2, or Coolify's scheduled backups).
