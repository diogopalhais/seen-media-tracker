## 1. Contracts

- [x] 1.1 Add `PersonCreditSchema`, `CompanySchema`, `EpisodeRefSchema`, `ReleaseAlertSchema`, `LibraryReleasesResponseSchema`; extend `TitleDetailsSchema`, `MediaItemSchema`, `LibraryItemSummarySchema`; add profile/logo/person URL helpers and `isOngoingSeries`

## 2. API

- [x] 2.1 Provider types and TMDB mapping with `append_to_response` (credits, aggregate_credits, companies, networks, status, last/next episode)
- [x] 2.2 Schema columns and migration `0003`; `upsertItem`, `toMediaItem` carry status, episodes and `metadata_refreshed_at`
- [x] 2.3 Release alert SQL on the library list, `listReleases`, `staleShows`; `SnapshotRefresher` with budget; `GET /api/v1/library/releases`; title route maps enrichment
- [x] 2.4 Stub fixtures and integration tests: title enrichment, alert rules (new, season log, backlog, upcoming), releases order, refresh (stale, ended, outage)

## 3. Web

- [x] 3.1 API client, queries (`libraryReleases`), formatting helpers (status, relative episode date)
- [x] 3.2 `CastRow` and `TitleDetailsList`; wire into `TitleScreen` and `LibraryItemScreen` (title fetched for movies too)
- [x] 3.3 `ReleasesShelf` and "New episode" badge on `LibraryScreen`
- [x] 3.4 Component tests for the details list and shelf formatting; screenshots reviewed

## 4. Verification

- [x] 4.1 Lint, typecheck, all tests, production build; local review before push
