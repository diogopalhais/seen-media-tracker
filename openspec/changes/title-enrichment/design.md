## Context

Builds on `discover-ratings-episodes` and `episode-tracking`. Details already come from TMDB's movie/tv detail endpoints; TMDB's `append_to_response` returns credits, companies and episode-to-air data in the same call, so enrichment is free in request count. Snapshots in `media_items` are refreshed only when a watch is logged, which is too rare for release alerts.

## Goals / Non-Goals

**Goals:** richer title screens with zero extra upstream calls; release alerts that need no push infrastructure; keep everything additive on the API.

**Non-Goals:** notifications (push or email), person pages, full episode guides, storing cast or companies.

## Decisions

- **Live enrichment, stored broadcast state.** Cast, crew, networks and companies are served live from the title endpoint (cached one hour in the provider cache) and not stored. Status and the last/next episode are stored on `media_items` because alerts must be computed for the whole library in SQL. The library item screen now fetches the title for movies too, degrading silently offline.
- **`append_to_response`**: `credits` for movies, `aggregate_credits` for series (roles across seasons), plus `created_by`, `networks`, `production_companies`, `status`, `last_episode_to_air`, `next_episode_to_air` from the main object. Cast is capped at 15 by TMDB order; movie crew keeps Director, Screenplay, Writer and Story, merged per person; series crew is `created_by` with role "Creator".
- **Alert rule in SQL** over the snapshot columns and the two watch tables, evaluated against "today" as the latest date anywhere on Earth (same lenience as episode marking). New episode: aired within 30 days, not ticked, not covered by a season/series log dated on or after the air date. Upcoming: next air date within 14 days. New wins over upcoming.
- **Lazy refresh with a time budget.** A `SnapshotRefresher` picks up to six running series whose `metadata_refreshed_at` is null or older than six hours, refreshes them through the cached provider and `upsertItem`, and the route waits at most two seconds (`Promise.race`) before listing; slow refreshes still complete in the background. Ended and canceled series are skipped forever, so the steady-state cost is one TMDB call per running series per six hours. In-flight ids are de-duplicated across concurrent requests.
- **Releases endpoint** reuses the list query with an alert filter and a fixed limit, so the shelf and the grid badges agree.
- **Migration 0003** adds nullable columns (`status`, `last_episode_*`, `next_episode_*`, `metadata_refreshed_at`); existing rows get refreshed lazily.

## Risks / Trade-offs

- [First library open after deploy triggers up to six TMDB calls] → bounded by the budget; the list is served from snapshots regardless.
- [TMDB status labels are free text] → stored and displayed as-is with a light formatter ("Returning Series" → "Returning"); refresh eligibility checks only "Ended"/"Canceled".
- [Aggregate credits can be large for long-running shows] → parsed leniently and truncated to 15 cast.
- [Dark logos on dark backgrounds] → companies and networks are shown as text; logo URLs are in the contract for later.
