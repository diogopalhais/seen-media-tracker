## Purpose

Stores the owner's watched movies and TV series and the individual watch entries with dates, ratings and notes, and lets the owner browse, edit and maintain that history.

## ADDED Requirements

### Requirement: Library item identity and metadata snapshot
A library item SHALL be uniquely identified by the pair of media type and TMDB id. Logging a watch for a title that already exists in the library SHALL reuse the existing item rather than creating a duplicate. Each item SHALL hold a snapshot of the title's metadata (title, original title, year, poster, backdrop, overview, genres, runtime for movies, season count for TV) captured when the item was created so the library remains readable if the metadata provider is unavailable.

#### Scenario: First watch creates the item
- **WHEN** a watch is logged for a title not yet in the library
- **THEN** a library item is created with the title's metadata and the watch entry is attached to it

#### Scenario: Subsequent watch reuses the item
- **WHEN** a watch is logged for a title already in the library
- **THEN** no new item is created and the item's watch count increases by one

#### Scenario: Library readable without provider
- **WHEN** TMDB is unreachable
- **THEN** the library list and item details still load from stored metadata

### Requirement: Log a watch
The API SHALL expose a private endpoint to log a watch with: media type, TMDB id, the date watched (`YYYY-MM-DD`, not later than today in UTC+14), an optional rating, an optional season number (TV series only, integer of 0 or more, where absent means the whole series or unspecified), and an optional note of at most 2000 characters. Ratings SHALL be whole numbers from 1 to 10 inclusive. On success the API SHALL respond `201` with the created entry and its library item.

#### Scenario: Valid movie watch
- **WHEN** the owner logs a movie with date `2026-09-10`, rating `9` and no note
- **THEN** the API responds `201` with the entry showing that date and rating

#### Scenario: Valid TV watch with season
- **WHEN** the owner logs a TV series with season `2`
- **THEN** the entry records season `2`

#### Scenario: Future date rejected
- **WHEN** the date watched is after today
- **THEN** the API responds `400` with error code `validation_error` naming the `watchedOn` field

#### Scenario: Rating outside scale rejected
- **WHEN** the rating is `0`, `11`, or not an integer such as `7.5`
- **THEN** the API responds `400` with error code `validation_error` naming the `rating` field

#### Scenario: Season on a movie rejected
- **WHEN** a season number is supplied for a movie
- **THEN** the API responds `400` with error code `validation_error` naming the `season` field

#### Scenario: Unknown title rejected
- **WHEN** the TMDB id does not correspond to a title of the given type
- **THEN** the API responds `404` with error code `not_found` and nothing is stored

### Requirement: Multiple watches per title
A library item SHALL support any number of watch entries so that rewatches and successive seasons are recorded separately. Entries SHALL be ordered by date watched descending, then by creation time descending.

#### Scenario: Rewatch preserved
- **WHEN** the owner logs the same movie on two different dates
- **THEN** both entries are listed on the item, most recent first

#### Scenario: Same-day ordering
- **WHEN** two entries share the same date watched
- **THEN** the entry created later appears first

### Requirement: Displayed rating derives from the latest rated watch
An item's displayed rating SHALL be the rating of its most recent watch entry that has a rating. If no entry has a rating the item's rating SHALL be null.

#### Scenario: Latest entry rated
- **WHEN** the most recent entry has rating `8`
- **THEN** the item's rating is `8`

#### Scenario: Latest entry unrated, earlier rated
- **WHEN** the most recent entry has no rating and an earlier entry has rating `7`
- **THEN** the item's rating is `7`

#### Scenario: No rated entries
- **WHEN** no entry on the item has a rating
- **THEN** the item's rating is null

### Requirement: Edit a watch entry
The API SHALL expose a private endpoint to update any subset of a watch entry's date, rating, season and note, applying the same validation as logging. A rating or note SHALL be removable by setting it to null.

#### Scenario: Change rating
- **WHEN** the owner updates an entry's rating from `6` to `9`
- **THEN** the API responds `200` with the updated entry and the item's displayed rating reflects the change if this is the latest rated entry

#### Scenario: Remove note
- **WHEN** the owner sets an entry's note to null
- **THEN** the entry no longer has a note

#### Scenario: Unknown entry
- **WHEN** an update targets an entry id that does not exist
- **THEN** the API responds `404` with error code `not_found`

### Requirement: Delete a watch entry
The API SHALL expose a private endpoint to delete a watch entry. When an item's last watch entry is deleted the item SHALL be removed from the library as well, because the library only contains titles that have been watched.

#### Scenario: Delete one of several entries
- **WHEN** an item has two entries and one is deleted
- **THEN** the API responds `204` and the item remains with one entry

#### Scenario: Delete the last entry
- **WHEN** an item's only entry is deleted
- **THEN** the API responds `204` and the item no longer appears in the library

### Requirement: List the library
The API SHALL expose a private endpoint listing library items with: item id, media type, title, year, poster URL, displayed rating, most recent date watched, watch count and most recent season (TV). It SHALL support filtering by media type (`all`, `movie`, `tv`), sorting by `recent` (most recent date watched, default), `title` (alphabetical) or `rating` (highest first, unrated last), and cursor-based pagination with a default page size of 30 and a maximum of 100.

#### Scenario: Default listing
- **WHEN** the library is requested without parameters
- **THEN** items are ordered by most recent date watched descending and at most 30 are returned with a cursor when more exist

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
The API SHALL expose a private endpoint returning a single library item with its metadata snapshot, displayed rating, watch count and the full ordered list of watch entries.

#### Scenario: Item with history
- **WHEN** an item with three entries is requested
- **THEN** the response contains the item and all three entries in the defined order

#### Scenario: Unknown item
- **WHEN** an item id that does not exist is requested
- **THEN** the API responds `404` with error code `not_found`

### Requirement: Web library screen
The Library tab SHALL show the owner's items as a poster grid ordered by most recent watch, with a segmented control for All, Movies and TV and a sort control offering Recent, Title and Rating. Each poster SHALL show the title and displayed rating as a numeric badge such as `8/10`. Tapping an item SHALL open its detail screen. When the library is empty a message SHALL point the owner to the Search tab.

#### Scenario: Grid with ratings
- **WHEN** the library has items
- **THEN** posters are shown in a grid with title and a numeric rating badge beneath each

#### Scenario: Switch to TV
- **WHEN** the owner selects the TV segment
- **THEN** only TV series are shown and the choice persists while the app stays open

#### Scenario: Empty library
- **WHEN** the library has no items
- **THEN** an empty-state message with a "Search" action is shown

#### Scenario: Loading more
- **WHEN** the owner scrolls near the end of a page that has a next cursor
- **THEN** the next page is fetched and appended

### Requirement: Web library item detail screen
The item detail screen SHALL show the backdrop or poster, title, year, media type, genres, runtime or season count, displayed rating, overview and the watch history as a list where each entry shows date watched, season (if any), rating and note. It SHALL offer a "Log Another Watch" action, per-entry Edit and Delete actions, and a link to the title on TMDB that opens outside the app.

#### Scenario: History listed
- **WHEN** the owner opens an item with two watches
- **THEN** both entries are visible with their date, rating and note

#### Scenario: Edit entry
- **WHEN** the owner chooses Edit on an entry
- **THEN** the log-watch sheet opens pre-filled with that entry's values and saving updates the entry in place

#### Scenario: Delete entry with confirmation
- **WHEN** the owner chooses Delete on an entry
- **THEN** a confirmation with a destructive-styled Delete action is shown and the entry is removed only after confirming

#### Scenario: Deleting the last entry leaves the screen
- **WHEN** the owner deletes an item's only entry
- **THEN** the app returns to the Library tab and the item is no longer listed

### Requirement: Web log-watch sheet
Logging or editing a watch SHALL happen in a sheet containing: the title being logged (read-only), a date field defaulting to today's local date, a rating control presenting the whole numbers 1 to 10 as a single row of numbered buttons, where the selected value and all lower values are highlighted and the selection can be cleared, a season picker listing the title's seasons for TV series (default "Whole series"), an optional note field, and Save and Cancel actions. Save SHALL be disabled while a request is in flight and validation errors SHALL be shown inline next to the offending field.

#### Scenario: Defaults for a new watch
- **WHEN** the sheet opens for a new watch
- **THEN** the date is today, no rating is selected, no season is selected and the note is empty

#### Scenario: Pick a rating
- **WHEN** the owner taps the button labelled `7`
- **THEN** the rating becomes `7`, buttons 1 to 7 are highlighted and the value is announced to assistive technology as "7 out of 10"

#### Scenario: Clear a rating
- **WHEN** the owner taps the already selected rating button or the Clear control
- **THEN** no rating is selected and saving stores a null rating

#### Scenario: Save success
- **WHEN** the owner saves a valid watch
- **THEN** the sheet closes and the item detail screen shows the new entry

#### Scenario: Server validation error
- **WHEN** the API rejects the watch with a validation error
- **THEN** the sheet stays open and shows the error next to the relevant field

#### Scenario: Cancel with changes
- **WHEN** the owner dismisses the sheet after changing a field
- **THEN** a confirmation asks whether to discard the changes
