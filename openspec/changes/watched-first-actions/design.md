## Context

Web-only refinement of screens shipped in `media-tracker-mvp`, `discover-ratings-episodes` and `episode-tracking`. No contract changes.

## Decisions

- **One `WatchActions` component** used by both the search title screen and the library item screen, fed by the library item detail (entries, rating). It renders the primary "Mark as Watched" button when no entry exists, otherwise the watched status card. Marking uses the existing log-watch mutation with today's local date and null rating; rating uses the existing update mutation on the most recent entry via a small `RateSheet` wrapping `RatingPicker`.
- **Search title screen fetches the library item** through the title's `libraryItemId` (already done for TV) so it can show the watched date and rating; after marking, the title query invalidation makes the membership appear and the status card takes over without navigation.
- **`AudienceRating` replaces `TmdbRating`**: people icon + average (+ compact votes). Kept as a distinct monochrome figure so it never competes with the owner's star badge. Order rule: people's first, owner's second, one line.
- Library cards drop the glass badge on the poster in favour of the single ratings line, keeping posters clean.

## Risks / Trade-offs

- [One-tap marking uses the device's local date] → matches the "watched today" intent; other dates go through "Log with details".
- [TV series: "Mark as Watched" logs the whole series] → episodes remain the progress layer; the Continue watching card sits above the status for series with ticks.
