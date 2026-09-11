## 1. Contracts

- [x] 1.1 Add `EpisodeWatchSchema`, `SetEpisodesWatchedRequestSchema`, `EpisodeWatchesResponseSchema`; add `episodeWatches` to `LibraryItemDetailSchema`, `episodesWatched` to `LibraryItemSummarySchema` (watchCount min 0), `episode` to `PublicRecentItemSchema`
- [x] 1.2 Implement and unit-test `computeProgress(seasons, watches)` in `packages/shared`

## 2. API

- [x] 2.1 Add `episode_watches` table with unique `(media_item_id, season_number, episode_number)` and generate migration `0002`
- [x] 2.2 Repository: set/unset episode watches, list for item, counts; update library invariant in delete paths; listing recency and `episodesWatched`; item detail `episodeWatches`; public feed union with `episode`
- [x] 2.3 Route `PUT /api/v1/watches/episodes` with validation, item creation from provider on first mark, idempotency
- [x] 2.4 Integration tests for marking, bulk, unmark, item creation, validation, unknown series, invariant on delete/unmark, listing and public feed with episode events

## 3. Web

- [x] 3.1 API client and queries: `setEpisodesWatched` mutation with optimistic update of the item detail cache and invalidations
- [x] 3.2 Season screen: checkmark per episode, per-season progress header, "Watched up to here" in expanded rows, "Mark season watched/unwatched"
- [x] 3.3 `ContinueWatchingCard` on `TitleScreen` and `LibraryItemScreen` using `computeProgress`; "12 eps" on library cards
- [x] 3.4 Component test for the season progress header and the card; screenshots reviewed

## 4. Verification

- [x] 4.1 Lint, typecheck, all tests, production build; commit and push with CI green
