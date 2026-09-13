## Why

Browsing and searching are different intents; folding Discover into the Search tab's empty state hides it and makes Search feel busy. Cards also cram title, year and ratings together, hurting scanability.

## What Changes

- Add a **Discover** tab (trending this week, popular movies, popular TV series) between Library and Search. Titles and seasons opened from Discover open inside the Discover tab's stack.
- Search returns to a plain search screen with an empty-state prompt.
- Card hierarchy on library cards, discover cards and search rows: larger title, year (and progress) on its own line, ratings on a separate line with clear spacing.

## Capabilities

### Modified Capabilities

- `web-app-shell`: four tab destinations instead of three.
- `discover`: Discover lives in its own tab rather than the Search empty state.
- `media-search`: Search empty state prompts to search; result rows use the new card hierarchy.
- `media-library`: library cards use the new card hierarchy.

## Impact

Web only: new Discover screen and routes, tab bar entry, card layout components. No API or contract changes.
