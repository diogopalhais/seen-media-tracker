## Why

Years of viewing history live in Trakt. Starting Seen from an empty library would mean either abandoning that history or re-entering it by hand.

## What Changes

- Add a **Trakt import**: the owner uploads the Trakt data export (zip or its JSON files) in Settings, sees a preview of what will be imported and what will be skipped, then imports in batches with progress. Movie plays become watch entries, episode plays become episode ticks, movie/show/season ratings become the owner's ratings. Watchlist, collection and per-episode ratings are reported as skipped, as are records without a TMDB id. Re-importing never duplicates.

## Capabilities

### New Capabilities

- `trakt-import`: Parsing Trakt export records in the client, previewing, and the batch import endpoint that maps them into library items, watch entries, episode watches and ratings.

## Impact

- API: `POST /api/v1/import/trakt` accepting up to 200 normalised records per call; TMDB details fetched (cached) for unknown titles; idempotent inserts.
- Shared: import record and result schemas.
- Web: `fflate` for reading the zip in the browser, an Import sheet in Settings with preview, progress and summary.
