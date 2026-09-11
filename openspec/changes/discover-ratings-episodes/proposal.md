## Why

After using the MVP, four gaps stand out: the library filter and sort controls take a full row for something touched rarely; there is nothing to browse when the search field is empty; the app shows only my own rating and never what the wider audience thinks; and TV series stop at the season number, with no way to see the episodes I watched. This change closes those gaps on top of the shipped MVP.

## What Changes

- Move the Library type filter and sort into a single filter button in the navigation bar's trailing corner that opens a compact sheet; the button shows an indicator when a non-default filter or sort is active.
- Add **Discover** content to the Search tab's empty state: trending titles this week, popular movies and popular TV series from TMDB, as horizontal poster rows.
- Show the **TMDB community rating** (average out of 10 and vote count) on search results, discover cards, title details and library items, visually distinct from the owner's rating. The library snapshot stores it so the library shows it offline.
- Add a **season detail screen** for TV series listing every episode (still image, number, name, air date, runtime, overview, TMDB rating), reached from a Seasons list on TV title screens, with a shortcut to log a watch of that season.

## Capabilities

### New Capabilities

- `discover`: Trending and popular movies and TV series from TMDB for browsing when no search is active.
- `tv-seasons`: Season and episode details for TV series and the navigation to them.

### Modified Capabilities

- `media-library`: The library filter and sort move from an inline control row to a header button and sheet; library items and the item detail expose the TMDB community rating.
- `media-search`: Search results and title details include the TMDB community rating; the Search tab's empty state shows Discover content; TV title details list seasons that navigate to the season screen.

## Impact

- API: new endpoints `GET /api/v1/discover` and `GET /api/v1/titles/tv/:tmdbId/seasons/:seasonNumber`; two new columns on `media_items` (migration); search, title and library responses gain `tmdbRating` fields (additive).
- Shared contracts: new Discover, Season and Episode schemas; additive fields on existing schemas.
- Web: Library header filter sheet, Discover rows, community rating badge, Seasons list, Season screen and two new routes.
- TMDB usage grows by three cached calls per hour for Discover and one per season viewed; all cached server-side.
- Public feed unchanged.
