## Context

Extends the shipped MVP (`media-tracker-mvp`). Same stack: Hono API with Drizzle on Postgres, React PWA, shared Zod contracts. TMDB already provides everything needed: `vote_average`/`vote_count` on every list and detail payload, `/trending/all/week`, `/movie/popular`, `/tv/popular`, and `/tv/{id}/season/{n}`.

## Goals / Non-Goals

**Goals:** additive API changes only (v1 stays backwards compatible), everything cached server-side so TMDB usage stays negligible, no new tabs.

**Non-Goals:** per-episode watch tracking (watch entries stay per series or per season), personalised recommendations, storing discover or episode data in the database.

## Decisions

- **Discover lives in the Search tab's empty state**, not a fourth tab. HIG browsing patterns (App Store, Apple TV) put discovery behind Search; it also keeps the tab bar at three items.
- **Trending uses `/trending/all/week` filtered to movies and TV** (TMDB also returns people there). Popular lists use `/movie/popular` and `/tv/popular`. All three are one `GET /api/v1/discover` response cached for one hour in the existing LRU, key `discover:<language>`.
- **Community rating is stored on the snapshot** as `tmdb_vote_average real` and `tmdb_vote_count integer` so library screens work offline; it is refreshed by the existing upsert on later watches. Exposed on the wire as `tmdbRating: { average: number | null, count: number }` on search results, discover cards, title details and media items. Average is rounded to one decimal.
- **Season endpoint is proxied live** (`/tv/{id}/season/{n}`, cached one hour, key `season:<id>:<n>`) rather than stored; episode data changes often and is only viewed.
- **Filter sheet reuses `Sheet`** with two `SegmentedControl`s; selection applies immediately and closes the sheet for Type (the common action), stays open for Sort. Active state indicator is a small tint dot on the `SlidersHorizontal` icon. Filters remain module-level state as today.
- **Season screen routes** exist under both tab trees so the pane model is preserved: `/search/tv/:tmdbId/season/:seasonNumber` and `/library/:itemId/season/:seasonNumber` (the library variant resolves the TMDB id from the item). One `SeasonScreen` component; the "Log Season N" action opens `LogWatchSheet` with a new `initialSeason` option.
- **Seasons list on the library item screen** comes from the live title details query (the snapshot has only a count); if TMDB is down the list is simply absent and the rest of the screen still renders.

## Risks / Trade-offs

- [Discover adds three TMDB calls] → one-hour cache; a single owner cannot exceed limits.
- [Stored community rating goes stale] → refreshed on each new watch of the title; acceptable for a personal library.
- [Two new columns need a migration] → additive nullable columns, forward-only, generated with drizzle-kit and applied on start like the first migration.
