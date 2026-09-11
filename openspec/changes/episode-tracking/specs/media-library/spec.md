## MODIFIED Requirements

### Requirement: Delete a watch entry
The API SHALL expose a private endpoint to delete a watch entry. When an item's last watch entry is deleted and the item has no episode watches either, the item SHALL be removed from the library, because the library only contains titles with some recorded viewing.

#### Scenario: Delete one of several entries
- **WHEN** an item has two entries and one is deleted
- **THEN** the API responds `204` and the item remains with one entry

#### Scenario: Delete the last entry
- **WHEN** an item's only entry is deleted and it has no episode watches
- **THEN** the API responds `204` and the item no longer appears in the library

#### Scenario: Last entry but episodes remain
- **WHEN** a series' only season log is deleted while it still has episode watches
- **THEN** the API responds `204` and the series stays in the library

### Requirement: List the library
The API SHALL expose a private endpoint listing library items with: item id, media type, title, year, poster URL, displayed rating, community rating, most recent date watched (across watch entries and episode watches), watch count (number of watch entries, possibly 0), episodes watched count, and most recent season (TV). It SHALL support filtering by media type (`all`, `movie`, `tv`), sorting by `recent` (most recent activity, default), `title` (alphabetical) or `rating` (highest first, unrated last), and cursor-based pagination with a default page size of 30 and a maximum of 100. Items with only episode watches SHALL be listed.

#### Scenario: Default listing
- **WHEN** the library is requested without parameters
- **THEN** items are ordered by most recent activity descending and at most 30 are returned with a cursor when more exist

#### Scenario: Episode-only series listed
- **WHEN** a series has episode watches but no season or series log
- **THEN** it appears in the listing with watch count 0 and its episodes watched count

#### Scenario: Filter TV only
- **WHEN** the library is requested with type `tv`
- **THEN** only TV series items are returned

#### Scenario: Sort by rating
- **WHEN** the library is requested sorted by `rating`
- **THEN** rated items appear first in descending rating order and unrated items follow

#### Scenario: Follow cursor
- **WHEN** the library is requested with the cursor from a previous page
- **THEN** the next page continues from where the previous ended with no duplicates or gaps

### Requirement: Library item detail
The API SHALL expose a private endpoint returning a single library item with its metadata snapshot, displayed rating, watch count, the full ordered list of watch entries, and the list of episode watches (season number, episode number, date watched) in season-episode order.

#### Scenario: Item with history
- **WHEN** an item with three entries and four episode watches is requested
- **THEN** the response contains the item, all three entries in the defined order and the four episode watches

#### Scenario: Unknown item
- **WHEN** an item id that does not exist is requested
- **THEN** the API responds `404` with error code `not_found`

### Requirement: Web library screen
The Library tab SHALL show the owner's items as a poster grid ordered by most recent activity. The navigation bar SHALL show a single filter button in its trailing corner that opens a sheet containing a Type control (All, Movies, TV) and a Sort control (Recent, Title, Rating). The button SHALL display an indicator whenever the type is not All or the sort is not Recent, and the chosen filters SHALL persist while the app stays open. Each poster SHALL show the title, the displayed owner rating as a numeric badge such as `8/10`, the TMDB community rating when known, and for series tracked by episode the number of episodes watched. Tapping an item SHALL open its detail screen. When the library is empty a message SHALL point the owner to the Search tab.

#### Scenario: Grid with ratings
- **WHEN** the library has items
- **THEN** posters are shown in a grid with title, the owner's rating badge and the community rating beneath each

#### Scenario: Episode progress on cards
- **WHEN** a series has 12 episodes watched
- **THEN** its card shows "12 eps"

#### Scenario: Filter from the header
- **WHEN** the owner taps the filter button and selects TV
- **THEN** the sheet closes on selection, only TV series are shown, the filter button shows an active indicator, and the choice persists while the app stays open

#### Scenario: Empty library
- **WHEN** the library has no items
- **THEN** an empty-state message with a "Search" action is shown
