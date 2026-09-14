## 1. Repository and tooling

- [x] 1.1 Initialise git repository, `pnpm-workspace.yaml` with `apps/*` and `packages/*`, root `package.json` scripts (`lint`, `typecheck`, `test`, `build`), `.nvmrc`/`engines` pinned to Node 22, `.gitignore`, `.editorconfig`
- [x] 1.2 Add root TypeScript base config (strict) with project references and a `biome.json` for lint and format; add Vitest workspace config
- [x] 1.3 Add GitHub Actions workflow running install (frozen lockfile), Biome check, `tsc -b`, Vitest and both app builds on pull requests and `main`
- [x] 1.4 Add `README.md` covering local setup (including starting Postgres with `compose.dev.yaml`), environment variables, how to generate the owner password hash, and the deploy targets

## 2. Shared contracts package (`packages/shared`)

- [x] 2.1 Scaffold `packages/shared` with Zod as a dependency and build output consumable by both apps
- [x] 2.2 Define domain schemas: `MediaType`, `MediaItem` (metadata snapshot), `WatchEntry`, `LibraryItemSummary`, `LibraryItemDetail`, `Session`, `TitleDetails` (with seasons), `SearchResult`, `PublicRecentItem`
- [x] 2.3 Define request/response schemas for every endpoint: login, logout, session, search, title details, log watch, edit watch, delete watch, library list (filters, sort, cursor), library item, public recent, health, and the standard `ApiError` shape
- [x] 2.4 Implement helpers: integer rating schema (1..10, whole numbers only, nullable), `YYYY-MM-DD` date validation including the not-in-future rule, TMDB poster/backdrop URL builder and TMDB title URL builder
- [x] 2.5 Unit tests for rating boundaries (0, 1, 7.5, 10, 11, null), date rules and URL builders

## 3. API foundation (`apps/api`)

- [x] 3.1 Scaffold Hono on `@hono/node-server` with TypeScript, `tsx` dev script, and environment schema validated at boot (`PORT`, `DATABASE_URL`, `OWNER_PASSWORD_HASH`, `TMDB_API_TOKEN`, `TMDB_LANGUAGE`, `CORS_ORIGINS`, `TRUST_PROXY`, `LOG_LEVEL`) that exits with a clear message when invalid
- [x] 3.2 Add middleware: request id (echo or generate, header `X-Request-Id`), pino structured logging with request id, security headers (HSTS, nosniff, no server header), `Cache-Control: no-store` on private routes, JSON body limit of 100 KB, content-type check
- [x] 3.3 Add error handler producing `{ error: { code, message, details? } }` for 400/401/404/405/413/429/500/502, mapping Zod failures to `details` with field paths, and a JSON 404 for unknown routes
- [x] 3.4 Add CORS: allowlist policy from `CORS_ORIGINS` for `/api/v1/*` (Authorization and Content-Type headers, GET/POST/PATCH/DELETE/OPTIONS, preflight max-age 600) and wildcard GET/HEAD/OPTIONS policy for `/api/v1/public/*`
- [x] 3.5 Add in-memory sliding-window rate limiter keyed by client IP (forwarded-for trusted only when `TRUST_PROXY=1`), emitting `Retry-After` and `RateLimit-*` headers
- [x] 3.6 Add `GET /health` returning `ok` with version and uptime, or `503 degraded` when a `SELECT 1` against Postgres fails, with `Cache-Control: no-store`
- [x] 3.7 Integration tests for error shape, unknown route, request id echo, body limit, content type, CORS allowed/denied origins, rate-limit headers, and health

## 4. Database

- [x] 4.1 Add `compose.dev.yaml` running `postgres:17-alpine` with a published port and a `pgdata-dev` volume, plus `.env.example` with a matching `DATABASE_URL`
- [x] 4.2 Add Drizzle ORM with the postgres.js driver; create the connection pool from `DATABASE_URL`; add a bounded wait-for-database step at startup; wire PGlite through Drizzle's PGlite driver for tests via a small `createDb()` factory
- [x] 4.3 Define Drizzle schema for `media_items` (media_type enum, jsonb genres, unique `(media_type, tmdb_id)`), `watch_entries` (FK cascade, `watched_on` date, smallint rating CHECK 1..10, indexes) and `sessions` (unique `token_hash`), all timestamps `timestamptz`
- [x] 4.4 Generate the initial SQL migration with drizzle-kit, commit it, and run pending migrations at process start under a Postgres advisory lock
- [x] 4.5 Implement graceful shutdown on `SIGTERM`/`SIGINT` that stops the HTTP server and closes the database pool

## 5. Authentication

- [x] 5.1 Add `hash-password` CLI script producing an argon2id hash for `OWNER_PASSWORD_HASH`
- [x] 5.2 Implement `POST /api/v1/auth/login`: validate body, verify argon2id hash, issue 32-byte base64url token, store SHA-256 hash with 30-day expiry and user agent, return token and `expiresAt`; generic `401 invalid_credentials` on failure
- [x] 5.3 Implement bearer auth middleware: hash presented token, look up session, reject expired/unknown/missing/non-Bearer with `401` plus `WWW-Authenticate: Bearer`, update `last_used_at` at most once per minute, attach session to context
- [x] 5.4 Implement `POST /api/v1/auth/logout` (revoke current session, `204`) and `GET /api/v1/auth/session` (`authenticated`, `expiresAt`)
- [x] 5.5 Apply login throttling: 5 failures per IP per 15 minutes, `429` before password verification once exceeded, counter reset on success
- [x] 5.6 Integration tests for every auth spec scenario: correct/incorrect/malformed login, expired and unknown tokens, logout revocation, missing and non-Bearer headers, sixth failed attempt throttled, window expiry, session introspection, and that no registration route exists

## 6. TMDB integration and search

- [x] 6.1 Implement a `MetadataProvider` interface and TMDB implementation using the v4 bearer token: search movies, search TV, movie details, TV details (with seasons), with `TMDB_LANGUAGE`; map network/5xx failures to `upstream_unavailable` and 404 to `not_found`
- [x] 6.2 Add in-process LRU caching (search 5 min, details 1 h) in front of the provider
- [x] 6.3 Implement `GET /api/v1/search` (query trimmed, 1..200 chars, `type` all/movie/tv, `page`): parallel movie and TV search for `all`, merge by popularity, page of at most 20 with `hasMore`, and `inLibrary`/`libraryItemId` enrichment from the database
- [x] 6.4 Implement `GET /api/v1/titles/:mediaType/:tmdbId` returning normalised details, seasons (including flagged specials) for TV, and library membership
- [x] 6.5 Integration tests with a stubbed provider: combined results, type filter, empty results, empty/whitespace/too-long query, provider failure mapping, movie vs TV details, unknown id, invalid media type, and library membership flags

## 7. Library and watch entries

- [x] 7.1 Implement repository functions: upsert media item snapshot from provider details, insert/update/delete watch entries, delete item when its last entry is removed (transactional), and queries for item detail, library listing and public recent
- [x] 7.2 Implement `POST /api/v1/watches`: validate body (date not in future, integer rating 1..10, season only for TV, note ≤ 2000), fetch details from provider on first watch, reuse existing item, respond `201` with entry and item
- [x] 7.3 Implement `PATCH /api/v1/watches/:id` (partial update, null clears rating/note, same validation) and `DELETE /api/v1/watches/:id` (`204`, removes orphaned item)
- [x] 7.4 Implement `GET /api/v1/library` with `type`, `sort` (recent default, title, rating with unrated last), cursor pagination (default 30, max 100), computing displayed rating, last watched, watch count and latest season
- [x] 7.5 Implement `GET /api/v1/library/:id` returning the item with all entries ordered by `watched_on` desc, `created_at` desc
- [x] 7.6 Integration tests for every media-library API scenario: item creation and reuse, validation failures with field paths, unknown title, rewatch ordering, same-day ordering, displayed-rating derivation, edit and null-clear, delete one vs last entry, list defaults, filters, sorting and cursor continuity, item detail and 404

## 8. Public recent feed

- [x] 8.1 Implement `GET /api/v1/public/recent` (`limit` 1..50, default 10): one item per title using its latest watch, ordered by date then creation, fields limited to the public contract, plus `generatedAt`
- [x] 8.2 Add strong ETag from payload hash, `Cache-Control: public, max-age=300, stale-while-revalidate=600`, `304` on matching `If-None-Match`, `405` for non-read methods, and the 60 req/min public rate limit
- [x] 8.3 Integration tests: default limit, rewatch dedup, limit validation, empty library, no note or internal ids in output, wildcard CORS header, `405` on POST, ETag `304` and change on new watch, 61st request throttled

## 9. API container, Compose stack and Coolify deployment

- [x] 9.1 Write a multi-stage Dockerfile (pnpm fetch and install with lockfile, build shared and api, prune to production, `node:22-alpine`, non-root user, `HEALTHCHECK` on `/health`) and a `.dockerignore`
- [x] 9.2 Write the production `compose.yaml`: `api` service built from the Dockerfile with `depends_on` on a healthy `db`, environment passed through from Coolify, and `db` service `postgres:17-alpine` with `pgdata` named volume, `pg_isready` healthcheck, credentials from environment and no published port
- [x] 9.3 Add Docker build and `docker compose config` validation steps to CI (no push) and document the Coolify setup: Docker Compose app from the repo, environment variables (`DATABASE_URL` pointing at the `db` service, Postgres credentials, `TRUST_PROXY=1`), domain `api.seen.<domain>` attached to the `api` service with automatic TLS
- [x] 9.4 Deploy the stack to Coolify, verify `/health` over HTTPS, confirm migrations ran and the `pgdata` volume persists across a redeploy

## 10. Web app foundation (`apps/web`)

- [x] 10.1 Scaffold React 19 + Vite + TypeScript, Tailwind CSS v4, React Router, TanStack Query; wire `VITE_API_BASE_URL`; add Vitest with Testing Library
- [x] 10.2 Define design tokens as CSS variables: iOS semantic colours for light and dark (`prefers-color-scheme` and `[data-theme]`), tint and destructive colours, rem-based type scale mirroring iOS text styles, 8 px spacing scale, 44 px min target size, system font stack; expose them to Tailwind via `@theme`
- [x] 10.3 Implement typed `apiClient` over `fetch`: attaches bearer token, parses with shared schemas, maps the standard error shape to `ApiError`, clears the token and redirects to `/login` on `401`; token storage in `localStorage` with in-memory fallback
- [x] 10.4 Implement routing skeleton: `/login`, `/` redirect, `/library`, `/library/:itemId`, `/search`, `/search/:mediaType/:tmdbId`, `/settings`, an auth guard layout and per-tab kept-alive route trees with scroll restoration
- [x] 10.5 Build core primitives: `TabBar` (bottom bar with blur and safe-area padding; sidebar at ≥768 px; filled icon when active; reselect pops to root), `NavBar` with collapsing large title and back control, `InsetGroupedList` (rows, headers, footers, chevrons), `Button` (primary, plain, destructive), `Skeleton`, `Banner` (error/offline with retry)
- [x] 10.6 Build modal primitives: `Sheet` on `vaul` with grabber, swipe/Escape dismissal and unsaved-changes confirmation; `AlertDialog` on Radix with red destructive action and cancel default
- [x] 10.7 Build input primitives: `SegmentedControl` on Radix RadioGroup, `SearchField` (type search, 16 px font, clear button), `DateField`, `TextArea`, and `RatingPicker` (row of ten 44 px buttons wrapping on narrow screens, highlight up to the selection, tap selected value or Clear to unset, keyboard arrows step by one, radiogroup semantics announcing "N out of 10")
- [x] 10.8 Apply motion rules: 250–350 ms ease-out transitions on transform/opacity only, all gated behind `prefers-reduced-motion`
- [x] 10.9 Component tests for `RatingPicker` (select 7, highlight range, keyboard step, announcements, clear), `SegmentedControl` and `Sheet` unsaved-changes prompt

## 11. Login and Settings screens

- [x] 11.1 Build the Login screen: single password field (no autocapitalise/autocorrect, ≥16 px), inline error that keeps focus and value, navigates to Library on success, shows a message when arriving after a `401`
- [x] 11.2 Build the Settings screen as grouped inset lists: Appearance (System/Light/Dark persisted, updates `data-theme` and `theme-color`), Install section (see 13.3), About with TMDB attribution notice and logo, and Log Out with confirmation calling the logout endpoint
- [x] 11.3 Verify auth flow scenarios manually and with a component test: first launch shows login, relaunch with token skips login, wrong password feedback, logout returns to login

## 12. Search, Library and Watch screens

- [x] 12.1 Build the Search tab: search field in the nav bar area, 400 ms debounce, stale-response discarding via query keys, results list with poster thumbnail, title, year, media-type badge (text plus icon) and "Seen" indicator; empty state, loading skeletons and inline error with Retry
- [x] 12.2 Build the Title detail screen (from search): backdrop/poster header, title, year, type, genres, runtime or season count, overview, "Log Watch" primary action, existing rating and link to library item when already seen, external TMDB link opening outside the app
- [x] 12.3 Build the Library tab: poster grid with title and numeric rating badge (`8/10`), segmented control All/Movies/TV (persisted while the app is open), sort control Recent/Title/Rating, infinite scroll via `nextCursor`, empty state with "Search" action, responsive columns (2 at 320 px, more as width grows)
- [x] 12.4 Build the Library item detail screen: header and metadata, displayed rating, overview, watch history list (date, season, rating, note), "Log Another Watch", per-entry Edit and Delete (confirmation with destructive style), return to Library after deleting the last entry, TMDB external link
- [x] 12.5 Build the Log Watch sheet used for create and edit: read-only title, date defaulting to today's local date, `RatingPicker` clearable, season picker for TV (default "Whole series", seasons from title details), note field, Save disabled while in flight, inline server validation errors mapped by field path, offline message that preserves input
- [x] 12.6 Wire TanStack Query keys and invalidations (`library*`, `library-item`, `title`) so logging, editing and deleting update the grid, detail and search "Seen" badges without manual refresh

## 13. PWA

- [x] 13.1 Configure `vite-plugin-pwa` with `registerType: 'prompt'`: manifest (name/short_name "Seen", description, `id`, `start_url`, `scope`, `display: standalone`, theme and background colours, 192/512 icons in `any` and `maskable`), Workbox precache of the shell, `CacheFirst` for `image.tmdb.org` (500 entries, 30 days), `NetworkFirst` for private GETs with 10 s timeout, no caching of non-GET
- [x] 13.2 Add iOS head metadata: 180 px `apple-touch-icon`, `viewport-fit=cover`, Apple web-app-capable and status-bar-style tags, `theme-color` for light and dark; create the icon set (source SVG, generated PNGs, maskable variant)
- [x] 13.3 Implement update flow (check on launch, activate immediately before private data renders, otherwise "Update available" banner that reloads), offline indicator driven by online/offline events and query failures, and the Settings Install section (native prompt on Chromium, Share → Add to Home Screen instructions on iOS Safari, hidden in standalone)
- [ ] 13.4 Verify on devices: Lighthouse installability passes; Android install and standalone launch; iPhone Add to Home Screen, status bar blending, safe areas in portrait and landscape, offline launch shows cached library, offline save keeps input, external TMDB link opens in Safari, deep-link reload works

## 14. Cloudflare Pages deployment

- [x] 14.1 Add `public/_redirects` (`/* /index.html 200`) and `public/_headers` (CSP allowing self, `image.tmdb.org` images and the API origin for connect; `X-Frame-Options`, `Referrer-Policy`; `no-cache` for `index.html`, `sw.js` and manifest; `immutable` for hashed assets)
- [x] 14.2 Create the Cloudflare Pages project connected to the repository (build `pnpm install --frozen-lockfile && pnpm --filter web build`, output `apps/web/dist`, `VITE_API_BASE_URL` env), attach the custom domain, enable preview deployments
- [ ] 14.3 Set `CORS_ORIGINS` on Coolify to the Pages custom domain (and preview origin if desired), redeploy, and verify login, search, log watch and public feed end-to-end from an iPhone in standalone mode

## 15. Personal website integration and wrap-up

- [x] 15.1 Document the public feed contract (fields, caching, rate limit, versioning promise) in `README.md` with a minimal fetch-and-render example for the personal website
- [x] 15.2 Document backup and restore for PostgreSQL (`pg_dump` via cron or Coolify scheduled backup to object storage, one tested restore) and the rollback steps for Pages and Coolify
- [ ] 15.3 Run the full HIG manual checklist (large title collapse, tab state preservation, sheet gestures, alerts, dark mode switch without reload, 200 percent text, 320 px layout, reduced motion) and fix findings before declaring the MVP done
