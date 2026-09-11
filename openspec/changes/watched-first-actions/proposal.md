## Why

Two things from daily use: the community rating shouts "TMDB" on every card even though it is the only source, and the main thing I do with a title is simply mark it watched, yet the screens lead with a detailed "Log Watch" form. The interface should make "watched" one tap and rating optional.

## What Changes

- Present the community rating as a quiet people's rating (people icon, average, votes) without a source label on cards and screens; TMDB attribution stays in Settings. Where both appear, the people's rating comes first and the owner's star rating second, on one line.
- Make **Mark as Watched** the primary action on title and library item screens: one tap logs today's date with no rating. Once watched, the screen shows a "Watched · <date>" status with an optional **Rate** action; a rating, when present, is displayed there.
- Demote "log another watch" and "log with details" (date, season, note) to low-emphasis text actions.

## Capabilities

### Modified Capabilities

- `media-library`: Item detail screen leads with the watched status and optional rating; library cards show people's then owner's rating.
- `media-search`: Title detail screen and result cards present the people's rating without a source label; the primary action is Mark as Watched.

## Impact

- Web only: a shared `WatchActions` component replaces the "Log Watch" primary buttons on both screens; the rating badge component is renamed and restyled; card layouts adjusted. No API or contract changes.
