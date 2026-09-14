# Seen

A personal movie and TV tracker for one person. Search titles (metadata from TMDB), mark them watched, tick episodes, rate out of 10, get notified when a show you follow has a new episode, and expose a public "recently watched" feed for your own website. Installable on iPhone and Android as a PWA; designed after Apple's Human Interface Guidelines with a dark-first look.

This is personal software: one owner, one password, no accounts. Fork it and self-host it if it fits you.

- **Web app** (`apps/web`): React 19, Vite, Tailwind CSS v4, React Router, TanStack Query, `vite-plugin-pwa` with a custom service worker. Deployed to Cloudflare Workers (static assets) with Wrangler.
- **API** (`apps/api`): Hono on Node 22, Zod, Drizzle ORM, PostgreSQL 17, `web-push`. Runs as a Docker Compose stack on Coolify.
- **Shared contracts** (`packages/shared`): Zod schemas and types used by both.

Planning artifacts (proposal, specs, design, tasks per change) live in `openspec/changes/`.

## Features

- **Library**: poster grid of everything you have seen, filter by type, sort by recent, title or rating. Series you follow surface in a "New & upcoming" shelf when an episode aired that you have not watched, or airs within two weeks.
- **One-tap watched**: "Mark Watched" logs today; rating is optional and inline. Log again for rewatches, with date, season and a private note.
- **Episode tracking**: tick episodes individually, "Watched up to here", mark a whole season, and a Continue Watching card that knows where you stopped. Unaired episodes cannot be marked.
- **Title pages**: poster hero, synopsis, genres, people's rating next to yours, cast shelf, and a details list with status and next episode, network, studios, director or creators.
- **Discover**: trending this week, popular movies and popular series from TMDB, with a "seen" mark on what is already in your library.
- **Search**: movies and series with library membership flags.
- **New-episode notifications**: Web Push to installed devices (iPhone Home Screen app included), one notification per newly aired unwatched episode, never twice.
- **Trakt import**: bring your history and ratings over from a Trakt data export (zip or JSON), idempotent.
- **Public feed**: a small, cached, CORS-open JSON endpoint for your website, movies and shows separately if you like.
- **PWA**: offline shell, cached posters and last library data, prompt-based updates, light and dark themes.

## Screenshots

<table>
  <tr>
    <td><img src="docs/screenshots/library.jpg" width="240" alt="Library grid with the New & upcoming shelf"></td>
    <td><img src="docs/screenshots/title.jpg" width="240" alt="Series page with poster hero, Watched action and rating"></td>
    <td><img src="docs/screenshots/title-details.jpg" width="240" alt="Cast shelf and details list with status, network, studios and creator"></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/season.jpg" width="240" alt="Season page with episode ticks and progress"></td>
    <td><img src="docs/screenshots/discover.jpg" width="240" alt="Discover with trending and popular shelves"></td>
    <td><img src="docs/screenshots/settings.jpg" width="240" alt="Settings with appearance, notifications and Trakt import"></td>
  </tr>
</table>

Posters, stills and ratings shown are TMDB data.

## Local development

Prerequisites: Node 22 (`.nvmrc`), pnpm 10, Docker (for the local Postgres), a TMDB API read access token from <https://www.themoviedb.org/settings/api>.

```bash
pnpm install

# 1. Start PostgreSQL (localhost:5434, user/password/db = seen). Override the port with SEEN_DB_PORT.
pnpm db:up

# 2. Configure the API
cp apps/api/.env.example apps/api/.env
pnpm --filter @seen/api hash-password        # prompts for the owner password, prints the argon2id hash
#    → paste the hash into OWNER_PASSWORD_HASH and your TMDB token into TMDB_API_TOKEN in apps/api/.env

# 3. Run the API and the web app (two terminals)
pnpm dev:api                                  # http://localhost:3000 (migrations run on start)
pnpm dev:web                                  # http://localhost:5173

# Stop the database (data persists in the pgdata-dev volume)
pnpm db:down
```

The web app reads `VITE_API_BASE_URL` at build/dev time (defaults to `http://localhost:3000`; see `apps/web/.env.example`).

Useful scripts:

| Command | What it does |
| --- | --- |
| `pnpm lint` / `pnpm lint:fix` | Biome lint + format |
| `pnpm typecheck` | TypeScript across all packages |
| `pnpm test` | Vitest: shared unit tests, API integration tests (in-process PGlite), web component tests |
| `pnpm build` | Builds shared, API bundle (`apps/api/dist`) and web (`apps/web/dist`) |
| `pnpm --filter @seen/api db:generate` | Generate a new SQL migration after editing `apps/api/src/db/schema.ts` |

## Configuration

### API environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | yes | `postgres://user:password@host:5432/db` |
| `OWNER_PASSWORD_HASH` | yes | From `pnpm --filter @seen/api hash-password`. Use the **base64 line** it prints: the raw `$argon2id$…` form is corrupted by `$` interpolation in Docker Compose, Coolify and shells. |
| `TMDB_API_TOKEN` | yes | TMDB v4 read access token (kept server-side only) |
| `CORS_ORIGINS` | yes | Comma-separated web app origins, e.g. `https://seen.example.com` |
| `TRUST_PROXY` | no (`0`) | Set `1` behind Coolify/Traefik so `X-Forwarded-For` is trusted for rate limiting |
| `TMDB_LANGUAGE` | no (`en-US`) | Language for titles and overviews |
| `PORT` | no (`3000`) | Listen port |
| `LOG_LEVEL` | no (`info`) | pino level |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | no (all three or none) | Enable Web Push new-episode notifications. Generate keys with `pnpm --filter @seen/api vapid`; the subject is `mailto:you@example.com` or your site URL. Treat the private key as a secret and back it up: rotating it silently disables every device until it re-enables notifications. |
| `MIGRATIONS_DIR` | no | Override the migrations folder location |

The API refuses to start with a clear message if any required variable is missing or malformed.

### Web build variable

| Variable | Description |
| --- | --- |
| `VITE_API_BASE_URL` | Public API origin, e.g. `https://api.seen.example.com`. Also baked into the Content Security Policy and the service worker caching rule. |

## Deployment

### API + PostgreSQL on Coolify (Docker Compose)

`compose.yaml` at the repo root defines two services: `api` (built from `apps/api/Dockerfile`) and `db` (`postgres:17-alpine`, data on the `pgdata` volume, no published port).

1. In Coolify create a new **Application → Docker Compose** resource pointing at this repository (branch `main`, compose file `compose.yaml`).
2. Set the environment variables in Coolify (they are interpolated into the compose file):
   `POSTGRES_PASSWORD` (URL-safe, no `@ / : #`), `OWNER_PASSWORD_HASH` (the base64 line from `hash-password`; never the raw `$argon2id$` string), `TMDB_API_TOKEN`, `CORS_ORIGINS`, and optionally `POSTGRES_USER`, `POSTGRES_DB`, `TMDB_LANGUAGE`, `LOG_LEVEL`. `DATABASE_URL` is assembled inside the compose file from the `db` service name; `TRUST_PROXY=1` is already set.
3. Attach the domain (e.g. `api.seen.<your-domain>`) to the `api` service on port `3000`. Coolify's Traefik proxy terminates TLS with Let's Encrypt.
4. Deploy. Migrations run on start under an advisory lock; `GET /health` returns `{"status":"ok"}` when the database is reachable.
5. Enable "deploy on push" (GitHub webhook) so `main` deploys automatically.

CI builds the image and validates the compose file on every push; it does not deploy.

Optional: proxy the API hostname through Cloudflare (orange cloud). The public feed sends `Cache-Control: public, max-age=300, stale-while-revalidate=600` and an `ETag`, so the edge absorbs traffic from your website.

### Web app on Cloudflare (Workers static assets, via Wrangler)

Cloudflare Pages is now part of Workers, so the web app ships as a Worker that serves `apps/web/dist` as static assets. `apps/web/wrangler.toml` declares the custom domain; `wrangler deploy` creates the DNS record and certificate for it.

```bash
pnpm --filter @seen/web exec wrangler login          # browser login, once per machine
VITE_API_BASE_URL=https://api.seen.<your-domain> pnpm deploy:web
```

If a DNS record for the domain already exists (for example pointing at the API server), delete it in the Cloudflare dashboard first; Workers custom domains refuse to overwrite existing records.

**Continuous deploys**: `.github/workflows/deploy-web.yml` builds and publishes on every push to `main` that touches the web app or shared package. Configure the repository once:

- Secrets: `CLOUDFLARE_API_TOKEN` (permissions: *Workers Scripts: Edit*, *Workers Routes: Edit*, *Zone: Read*, *Zone: DNS: Edit* on the zone), `CLOUDFLARE_ACCOUNT_ID`
- Variable: `VITE_API_BASE_URL` (e.g. `https://api.seen.<your-domain>`)

Deep links fall back to `index.html` through `not_found_handling = "single-page-application"` in `wrangler.toml`, and the build emits `_headers` (CSP, security headers, `no-cache` for `index.html`/`sw.js`/manifest, immutable caching for hashed assets), which Workers static assets honour. The Worker also answers on `https://seen.<account>.workers.dev`, but the API only allows the custom domain origin, so use the custom domain for real sessions. `CORS_ORIGINS` on the API must include `https://seen.<your-domain>`.

### New-episode notifications (Web Push)

With the `VAPID_*` variables set, the API runs an hourly notifier that refreshes running series and sends one push per newly aired, unwatched episode to every device that turned on **Settings → Notifications → New episodes**. On iPhone the app must be installed to the Home Screen first. Run a single API replica: two instances would each announce. "Send a test notification" in Settings verifies the whole path.

### Rollback

- **API**: Coolify → the application → Deployments → redeploy a previous successful deployment. Migrations are forward-only; take a dump first (below) before deploying a release that includes a migration.
- **Web**: Cloudflare dashboard → Workers & Pages → `seen` → Deployments → roll back to the previous version (or `wrangler rollback`).

## Backups (PostgreSQL)

The whole library is in the `pgdata` volume. Take a logical dump regularly and ship it off the server:

```bash
# On the Hetzner host (container name from `docker ps`, e.g. seen-db-1)
docker exec -t <db-container> pg_dump -U seen -d seen --format=custom > seen-$(date +%F).dump

# Restore into an empty database
docker exec -i <db-container> pg_restore -U seen -d seen --clean --if-exists < seen-2026-09-11.dump
```

Schedule the dump (cron on the host, or Coolify's Scheduled Tasks on the `db` service) and copy the file to object storage (Cloudflare R2, Hetzner Storage Box) with `rclone`. Test one restore into a scratch database before relying on it.

## Public feed for your website

Unauthenticated, CORS-open (`Access-Control-Allow-Origin: *`), cached for 5 minutes, rate limited to 60 requests/minute per IP. Version 1 only ever **adds** fields.

```
GET https://api.seen.<your-domain>/api/v1/public/recent?limit=10     # limit: 1..50, default 10
GET https://api.seen.<your-domain>/api/v1/public/recent?type=movie   # type: all (default) | movie | tv
```

```json
{
  "items": [
    {
      "mediaType": "tv",
      "title": "Severance",
      "year": 2022,
      "posterUrl": "https://image.tmdb.org/t/p/w342/....jpg",
      "rating": 9,
      "watchedOn": "2026-09-03",
      "season": 2,
      "episode": 9,
      "tmdbUrl": "https://www.themoviedb.org/tv/95396"
    }
  ],
  "generatedAt": "2026-09-11T10:15:30.000Z"
}
```

Each title appears once, described by its most recent event. `rating` is your whole-number score 1–10 or `null`; `season` and `episode` are TV only, and `episode` is set when the latest event was an episode tick (otherwise the log's season, or `null` for a whole-series log); `posterUrl` may be `null`. Ratings, notes and everything else stay private.

Minimal embed:

```html
<ul id="seen"></ul>
<script type="module">
  const res = await fetch('https://api.seen.example.com/api/v1/public/recent?limit=6');
  const { items } = await res.json();
  document.getElementById('seen').innerHTML = items
    .map(
      (i) => `<li>
        <a href="${i.tmdbUrl}" rel="noopener">${i.posterUrl ? `<img src="${i.posterUrl}" alt="" width="92" loading="lazy">` : ''}
        ${i.title}${i.year ? ` (${i.year})` : ''}</a>
        ${i.rating ? ` · ${i.rating}/10` : ''} · ${i.watchedOn}
      </li>`,
    )
    .join('');
</script>
```

TMDB terms require attribution wherever their images or data appear: *"This product uses the TMDB API but is not endorsed or certified by TMDB."*

## What is public and what is not

- The repository contains no secrets: only `.env.example` files are tracked, and CI uses none. The TMDB token, the owner password hash, database password and VAPID keys live only in the deployment environment.
- The only unauthenticated endpoints are `/health` and the public feed above. The feed exposes title, year, poster, your rating, the date and the season or episode of the latest event, nothing else. Everything private requires the owner session.
- Sessions are opaque random tokens stored hashed; login is rate limited per IP; the web app ships a strict Content Security Policy.

## API overview

All routes are under `/api/v1`; errors are `{ "error": { "code", "message", "details?" } }`.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/login` | – | `{ password }` → `{ token, expiresAt }` (5 failures / 15 min per IP) |
| POST | `/auth/logout` | Bearer | Revoke the current session |
| GET | `/auth/session` | Bearer | `{ authenticated: true, expiresAt }` |
| GET | `/search?q=&type=all|movie|tv&page=` | Bearer | TMDB search with library membership flags |
| GET | `/titles/:mediaType/:tmdbId` | Bearer | Title details: seasons, cast and crew, networks and studios, status, last/next episode |
| POST | `/watches` | Bearer | Log a watch `{ mediaType, tmdbId, watchedOn, rating?, season?, note? }` |
| PATCH | `/watches/:id` | Bearer | Edit a watch (`null` clears rating/season/note) |
| DELETE | `/watches/:id` | Bearer | Delete a watch (removes the title when it was the last one) |
| GET | `/library?type=&sort=recent|title|rating&cursor=&limit=` | Bearer | Library grid data |
| GET | `/library/:id` | Bearer | Item with full history |
| GET | `/library/releases` | Bearer | Series with a new unwatched episode (last 30 days) or an upcoming one (next 14 days); refreshes stale snapshots of running series first |
| GET | `/push/config` | Bearer | Whether Web Push is configured, and the VAPID public key |
| PUT / DELETE | `/push/subscriptions` | Bearer | Register or remove this device's push subscription |
| POST | `/push/test` | Bearer | Send a test notification to every registered device |
| GET | `/public/recent?limit=&type=all|movie|tv` | – | Public feed, optionally movies or shows only |
| GET | `/health` (root) | – | `ok` / `degraded` |

Sessions are opaque 32-byte tokens, stored hashed, valid 30 days, sent as `Authorization: Bearer`.
