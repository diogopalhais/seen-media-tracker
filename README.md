# Seen

A personal movie and TV tracker. Search titles (metadata from TMDB), log when you watched them, rate them out of 10, and expose a public "recently watched" feed for your own website. Installable on iPhone and Android as a PWA; designed to Apple's Human Interface Guidelines.

- **Web app** (`apps/web`): React 19, Vite, Tailwind CSS v4, React Router, TanStack Query, `vite-plugin-pwa`. Hosted on Cloudflare Pages.
- **API** (`apps/api`): Hono on Node 22, Zod, Drizzle ORM, PostgreSQL 17. Runs as a Docker Compose stack on Coolify.
- **Shared contracts** (`packages/shared`): Zod schemas and types used by both.

Planning artifacts (proposal, specs, design, tasks) live in `openspec/changes/media-tracker-mvp/`.

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
| `CORS_ORIGINS` | yes | Comma-separated web app origins, e.g. `https://seen.example.com,https://seen-preview.pages.dev` |
| `TRUST_PROXY` | no (`0`) | Set `1` behind Coolify/Traefik so `X-Forwarded-For` is trusted for rate limiting |
| `TMDB_LANGUAGE` | no (`en-US`) | Language for titles and overviews |
| `PORT` | no (`3000`) | Listen port |
| `LOG_LEVEL` | no (`info`) | pino level |
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
      "tmdbUrl": "https://www.themoviedb.org/tv/95396"
    }
  ],
  "generatedAt": "2026-09-11T10:15:30.000Z"
}
```

Each title appears once (its most recent watch). `rating` is a whole number 1–10 or `null`; `season` is set for TV only; `posterUrl` may be `null`.

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

## API overview

All routes are under `/api/v1`; errors are `{ "error": { "code", "message", "details?" } }`.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/login` | – | `{ password }` → `{ token, expiresAt }` (5 failures / 15 min per IP) |
| POST | `/auth/logout` | Bearer | Revoke the current session |
| GET | `/auth/session` | Bearer | `{ authenticated: true, expiresAt }` |
| GET | `/search?q=&type=all|movie|tv&page=` | Bearer | TMDB search with library membership flags |
| GET | `/titles/:mediaType/:tmdbId` | Bearer | Title details (seasons for TV) |
| POST | `/watches` | Bearer | Log a watch `{ mediaType, tmdbId, watchedOn, rating?, season?, note? }` |
| PATCH | `/watches/:id` | Bearer | Edit a watch (`null` clears rating/season/note) |
| DELETE | `/watches/:id` | Bearer | Delete a watch (removes the title when it was the last one) |
| GET | `/library?type=&sort=recent|title|rating&cursor=&limit=` | Bearer | Library grid data |
| GET | `/library/:id` | Bearer | Item with full history |
| GET | `/public/recent?limit=` | – | Public feed |
| GET | `/health` (root) | – | `ok` / `degraded` |

Sessions are opaque 32-byte tokens, stored hashed, valid 30 days, sent as `Authorization: Bearer`.
