## Context

Builds on `media-tracker-mvp` and `discover-ratings-episodes`. Watch entries remain the unit for rating and notes (per series or per season); episode watches are a separate, finer-grained layer used for progress.

## Goals / Non-Goals

**Goals:** one tap per episode, bulk marking, instant UI feedback, correct "next up", library and public feed aware of episode activity, all additive on the API.

**Non-Goals:** per-episode ratings or notes, rewatch counts per episode, syncing progress from streaming services, storing episode metadata.

## Decisions

- **Separate `episode_watches` table** (`media_item_id`, `season_number`, `episode_number`, `watched_on`, `created_at`, unique on the triple) rather than overloading `watch_entries`. Entries carry ratings and notes and support rewatches; episode watches are a set. Mixing them would complicate both.
- **One idempotent endpoint** `PUT /api/v1/watches/episodes` with `{ tmdbId, episodes[], watched, watchedOn? }`. Bulk "up to here" and "mark season" are just longer lists built by the client from the season's episode list; the server stays simple (`insert … on conflict do nothing` / `delete … where in`). It returns the full episode-watch list so the client can replace its cache.
- **Library invariant becomes "has any activity"**: `exists(watch_entries) or exists(episode_watches)`. Deleting the last entry or unmarking the last episode removes the item only when both are empty. `lastWatchedOn` is the max across both tables; `watchCount` counts entries (may be 0); a new `episodesWatched` count is returned.
- **Progress is computed client-side** in a pure shared helper `computeProgress(seasons, watches)` because totals need TMDB's per-season episode counts, which the app already has from title details. Specials (season 0) are markable but excluded from totals and next-up.
- **Public feed** unions both tables into one event stream before the distinct-on-item step; the item gains a nullable `episode` (additive to v1).
- **Optimistic UI**: toggling a checkmark updates the season screen immediately via TanStack Query cache mutation, with rollback on error; invalidations refresh library, item detail, title and public-facing counts.

## Risks / Trade-offs

- [Episode counts change on TMDB (new episodes air)] → progress is recomputed from live season data on each view; stored watches are unaffected.
- [Long seasons (reality shows with 60+ episodes) mean long lists] → each request is capped at 500 episodes; rows are lightweight.
- [Two sources of truth for "watched a season" (season log vs all episodes ticked)] → they stay independent by design: ticks are progress, logs are the diary with rating; the UI offers "Log Season N" next to the ticks so both can be recorded when wanted.
