## 1. Ratings presentation

- [x] 1.1 Rename `TmdbRating` to `AudienceRating` (people icon, average, compact votes, no label); update search rows, discover cards, season episodes, title and item screens
- [x] 1.2 Library cards: single ratings line (people's then owner's star), remove the poster overlay badge

## 2. Watched-first actions

- [x] 2.1 `WatchActions` component: Mark as Watched (today, unrated) / watched status (date, times, Rate or star badge, "Log another watch") plus `RateSheet`
- [x] 2.2 Use it on `TitleScreen` (with "Log with details" secondary action, item detail via `libraryItemId`) and `LibraryItemScreen`
- [x] 2.3 Component tests for `WatchActions` states and `AudienceRating`; adjust existing tests and e2e selectors

## 3. Verification

- [x] 3.1 Lint, typecheck, tests, build; screenshots reviewed; commit and push with CI green
