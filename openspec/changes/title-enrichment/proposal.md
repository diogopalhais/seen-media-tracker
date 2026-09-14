## Why

Title screens show a poster, a synopsis and ratings, then stop. TMDB already returns the people behind a title, who airs and produces it, and whether a series is still running and when the next episode lands. Surfacing that turns the title screen into a reference, and knowing when a followed show has a new episode is the one nudge a tracker should give.

## What Changes

- Title details gain **cast and crew** (top billed cast with photos and characters; directors and writers for movies, creators for series), **networks and studios**, and **status** with the **last and next episode to air** for series.
- Title and library item screens show a cast shelf and a details list (status and next episode, network, studio, director or creator).
- The library snapshot stores status and the last/next episode of a series, and the API refreshes the snapshot of still-running series it has not checked in six hours when the library is opened.
- **Release alerts**: the library marks series with a recently aired episode the owner has not watched ("New episode") and lists upcoming episodes of followed series within two weeks. The Library screen gets a "New & upcoming" shelf and a badge on affected cards.

## Capabilities

### Modified Capabilities

- `media-search`: title details carry cast, crew, networks, production companies, status and last/next episode; title screens present them.
- `media-library`: library summaries carry a release alert; a releases endpoint lists series with new or upcoming episodes; snapshots of running series are refreshed periodically; the item snapshot exposes status and next episode.

## Impact

- Shared: new `PersonCredit`, `Company`, `EpisodeRef`, `ReleaseAlert` schemas; additive fields on `TitleDetails`, `MediaItem` and `LibraryItemSummary`.
- API: TMDB detail calls use `append_to_response` (credits / aggregate_credits), one extra migration (`0003`), new `GET /api/v1/library/releases`, a snapshot refresher used by the library routes.
- Web: `CastRow`, `TitleDetailsList`, `ReleasesShelf` components; changes to `TitleScreen`, `LibraryItemScreen`, `LibraryScreen`. No breaking API changes; the public feed is unchanged.
