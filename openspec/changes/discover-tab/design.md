## Decisions

- **Fourth tab, own stack.** Discover gets `/discover`, `/discover/:mediaType/:tmdbId` and `/discover/tv/:tmdbId/season/:n` so the pane model keeps its state. Title and season screens derive their tab root from the current pathname (`/discover` or `/search`) for Back and for nested links.
- **One card recipe** (`MediaCardText`): title `text-body font-semibold` (17px) clamped to two lines, a meta line (year, badge or progress) in footnote, then a ratings line with `mt-1.5`. Used by library cards, discover cards and search rows so the hierarchy reads the same everywhere.
- Search keeps a simple prompt when empty; recent searches are out of scope.
