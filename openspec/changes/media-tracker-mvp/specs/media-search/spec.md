## Purpose

Lets the owner find movies and TV series by title using metadata from The Movie Database (TMDB), preview a title's details, and pick it as the subject of a watch entry.

## ADDED Requirements

### Requirement: Search movies and TV series by title
The API SHALL expose a private search endpoint accepting a text query, an optional media type filter (`all`, `movie` or `tv`, default `all`) and an optional page number. It SHALL return normalised results containing for each title: TMDB id, media type, title, original title, release year (nullable), poster image URL (nullable), overview and popularity rank. When the type is `all`, results SHALL include both movies and TV series ordered by relevance. A page SHALL contain at most 20 results and the response SHALL state whether more pages exist.

#### Scenario: Query matches both media types
- **WHEN** the owner searches for "Dune" with type `all`
- **THEN** the response contains both movie and TV results, each labelled with its media type and year

#### Scenario: Filter by media type
- **WHEN** the owner searches with type `tv`
- **THEN** every result has media type `tv`

#### Scenario: No matches
- **WHEN** the query matches nothing
- **THEN** the API responds `200` with an empty result list

#### Scenario: Empty or whitespace query
- **WHEN** the query is missing, empty or only whitespace after trimming
- **THEN** the API responds `400` with error code `validation_error`

#### Scenario: Query too long
- **WHEN** the query exceeds 200 characters
- **THEN** the API responds `400` with error code `validation_error`

#### Scenario: Metadata provider unavailable
- **WHEN** TMDB cannot be reached or returns a server error
- **THEN** the API responds `502` with error code `upstream_unavailable` and does not expose provider internals

### Requirement: Search results indicate library membership
Each search result SHALL include an `inLibrary` boolean and, when true, the identifier of the corresponding library item, so the app can show that a title has already been seen.

#### Scenario: Title already in library
- **WHEN** a search result corresponds to a title with at least one watch entry
- **THEN** the result has `inLibrary: true` and a `libraryItemId`

#### Scenario: Title not in library
- **WHEN** a search result has never been logged
- **THEN** the result has `inLibrary: false` and no `libraryItemId`

### Requirement: Title details for preview
The API SHALL expose a private endpoint returning details for a single movie or TV series by media type and TMDB id: title, original title, year, release or first-air date, overview, poster URL, backdrop URL, genres, runtime in minutes for movies, and for TV series the number of seasons plus a list of seasons with season number, name and episode count. Specials (season 0) SHALL be included and flagged as such. Results SHALL also include library membership as defined for search results.

#### Scenario: Movie details
- **WHEN** details are requested for an existing TMDB movie id
- **THEN** the response includes runtime and genres and has no seasons list

#### Scenario: TV series details
- **WHEN** details are requested for an existing TMDB TV id
- **THEN** the response includes the number of seasons and a seasons list in ascending season-number order

#### Scenario: Unknown title
- **WHEN** details are requested for an id TMDB does not know
- **THEN** the API responds `404` with error code `not_found`

#### Scenario: Invalid media type
- **WHEN** details are requested with a media type other than `movie` or `tv`
- **THEN** the API responds `400` with error code `validation_error`

### Requirement: Web search screen
The Search tab SHALL show a search field at the top of the screen, request results automatically no more than 400 ms after typing stops, and present results as a list showing poster thumbnail, title, year and a media-type badge, with a "Seen" indicator for titles already in the library. Tapping a result SHALL open the title detail screen from which a watch can be logged.

#### Scenario: Results appear while typing
- **WHEN** the owner types "sever" and pauses
- **THEN** results for the current text appear within one network round-trip after the pause without pressing a submit button

#### Scenario: Stale responses are discarded
- **WHEN** the owner changes the query before a previous search response has arrived
- **THEN** only results for the latest query are shown

#### Scenario: Clearing the field
- **WHEN** the owner clears the search field
- **THEN** the results list is emptied and the empty-state guidance is shown

#### Scenario: Empty state
- **WHEN** the Search tab is opened with no query entered
- **THEN** a short prompt explains that movies and TV series can be searched

#### Scenario: Search failure
- **WHEN** the search request fails
- **THEN** an inline message with a Retry action is shown in place of results

### Requirement: Title detail screen from search
Opening a search result SHALL show the title's details (backdrop or poster, title, year, media type, genres, runtime or season count, overview) and a primary "Log Watch" action. If the title is already in the library, the screen SHALL also show its current rating and offer navigation to the library item.

#### Scenario: Log watch from search
- **WHEN** the owner taps "Log Watch" on a title detail screen
- **THEN** the log-watch sheet opens pre-filled with that title

#### Scenario: Already seen title
- **WHEN** the owner opens a title that is already in the library
- **THEN** the screen shows the existing rating and a link to the library item

### Requirement: TMDB attribution
The web app SHALL display the TMDB logo or name together with the notice "This product uses the TMDB API but is not endorsed or certified by TMDB" in the Settings screen.

#### Scenario: Attribution visible
- **WHEN** the owner opens Settings
- **THEN** the TMDB attribution notice is visible without scrolling past other sections into hidden areas
