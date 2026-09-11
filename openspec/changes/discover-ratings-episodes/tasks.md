## 1. Contracts and provider

- [x] 1.1 Add `TmdbRatingSchema` and `tmdbRating` to `SearchResultSchema`, `TitleDetailsSchema` and `MediaItemSchema`; add `SeasonSchema.airDate`; add `DiscoverResponseSchema`, `SeasonDetailsSchema`, `EpisodeSchema` and `SeasonParamsSchema` in `packages/shared`
- [x] 1.2 Extend the provider interface with `voteAverage`/`voteCount` on results and details, `trendingAll(window)`, `popularMovies()`, `popularTv()` and `tvSeason(tmdbId, seasonNumber)`; implement in `TmdbProvider` with Zod parsing and cache them in `CachedMetadataProvider` (one hour)

## 2. API

- [x] 2.1 Add `tmdb_vote_average` and `tmdb_vote_count` columns to `media_items`, generate migration `0001`, store them in the upsert and expose `tmdbRating` from `toMediaItem`
- [x] 2.2 Include `tmdbRating` in search results and title details; add `airDate` to seasons
- [x] 2.3 Add `GET /api/v1/discover` returning `trending`, `popularMovies`, `popularTv` with library membership
- [x] 2.4 Add `GET /api/v1/titles/tv/:tmdbId/seasons/:seasonNumber` with validation, 404 mapping and episode ordering
- [x] 2.5 Integration tests: rating fields on search/title/library, discover lists and caching, season details, unknown season, invalid season number

## 3. Web

- [x] 3.1 `TmdbRating` badge component (average out of 10 with vote count, distinct from the owner badge); show it on search rows, library cards, title and item detail screens
- [x] 3.2 Library: replace the accessory row with a header filter button (`SlidersHorizontal`, tint dot when non-default) opening a `FilterSheet` with Type and Sort segmented controls
- [x] 3.3 Discover: `useDiscoverQuery`, `PosterRow` horizontal carousel component, three rows in the Search tab empty state with skeletons and inline Retry
- [x] 3.4 Seasons: `useSeasonQuery`, Seasons inset list on `TitleScreen` and `LibraryItemScreen` for TV, `SeasonScreen` with expandable episode rows and "Log Season N" (LogWatchSheet `initialSeason`), routes under both tab trees
- [x] 3.5 Component tests for `FilterSheet` and the `TmdbRating` badge; update the e2e checks that referenced the old accessory controls

## 4. Verification

- [x] 4.1 Lint, typecheck, tests and production build pass; screenshots reviewed for the filter sheet, discover rows, season screen in light and dark
