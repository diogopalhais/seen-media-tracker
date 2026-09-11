## MODIFIED Requirements

### Requirement: Web library screen
The Library tab SHALL show the owner's items as a poster grid ordered by most recent watch. The navigation bar SHALL show a single filter button in its trailing corner that opens a sheet containing a Type control (All, Movies, TV) and a Sort control (Recent, Title, Rating). The button SHALL display an indicator whenever the type is not All or the sort is not Recent, and the chosen filters SHALL persist while the app stays open. Each poster SHALL show the title, the displayed owner rating as a numeric badge such as `8/10`, and the TMDB community rating when known. Tapping an item SHALL open its detail screen. When the library is empty a message SHALL point the owner to the Search tab.

#### Scenario: Grid with ratings
- **WHEN** the library has items
- **THEN** posters are shown in a grid with title, the owner's rating badge and the community rating beneath each

#### Scenario: Filter from the header
- **WHEN** the owner taps the filter button and selects TV
- **THEN** the sheet closes on selection, only TV series are shown, the filter button shows an active indicator, and the choice persists while the app stays open

#### Scenario: Default filters show no indicator
- **WHEN** type is All and sort is Recent
- **THEN** the filter button shows no indicator

#### Scenario: Empty library
- **WHEN** the library has no items
- **THEN** an empty-state message with a "Search" action is shown

#### Scenario: Loading more
- **WHEN** the owner scrolls near the end of a page that has a next cursor
- **THEN** the next page is fetched and appended

### Requirement: Library item identity and metadata snapshot
A library item SHALL be uniquely identified by the pair of media type and TMDB id. Logging a watch for a title that already exists in the library SHALL reuse the existing item rather than creating a duplicate. Each item SHALL hold a snapshot of the title's metadata (title, original title, year, poster, backdrop, overview, genres, runtime for movies, season count for TV, and the TMDB community rating average and vote count) captured when the item was created and refreshed on later watches, so the library remains readable if the metadata provider is unavailable.

#### Scenario: First watch creates the item
- **WHEN** a watch is logged for a title not yet in the library
- **THEN** a library item is created with the title's metadata including its TMDB community rating, and the watch entry is attached to it

#### Scenario: Subsequent watch reuses the item
- **WHEN** a watch is logged for a title already in the library
- **THEN** no new item is created and the item's watch count increases by one

#### Scenario: Library readable without provider
- **WHEN** TMDB is unreachable
- **THEN** the library list and item details still load from stored metadata, including the stored community rating
