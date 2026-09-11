## Purpose

Tracks which individual episodes of a TV series the owner has watched, so the app can show progress and the next episode to watch.

## ADDED Requirements

### Requirement: Mark episodes watched or unwatched
The API SHALL expose a private endpoint that sets the watched state of one or more episodes of a TV series identified by TMDB id. The request SHALL carry a list of `{ seasonNumber, episodeNumber }` pairs (1 to 500), a `watched` boolean and an optional date watched (`YYYY-MM-DD`, not in the future, default today). Marking SHALL be idempotent: already-watched episodes keep their original date; unmarking episodes that are not watched is a no-op. When the series is not yet in the library and at least one episode is being marked watched, the API SHALL create the library item from provider metadata. The response SHALL return the library item and its complete list of episode watches.

#### Scenario: Mark a single episode
- **WHEN** the owner marks S2 E5 of a series watched
- **THEN** the API responds `200` with the item and a list containing S2 E5 with today's date

#### Scenario: Mark up to here in bulk
- **WHEN** the owner marks S1 E1 through S1 E6 watched in one request
- **THEN** all six episodes are recorded and a second identical request changes nothing

#### Scenario: Unmark
- **WHEN** the owner unmarks S1 E6
- **THEN** the response no longer lists S1 E6 and the others remain

#### Scenario: First episode creates the library item
- **WHEN** an episode is marked for a series not in the library
- **THEN** a library item with the series snapshot is created and returned

#### Scenario: Validation
- **WHEN** the request has no episodes, a negative episode number, a future date, or targets a movie
- **THEN** the API responds `400` with error code `validation_error`

#### Scenario: Unknown series
- **WHEN** the TMDB id is not a TV series
- **THEN** the API responds `404` with error code `not_found`

### Requirement: Progress and next episode
Given a series' seasons (with episode counts) and its episode watches, the app SHALL compute: total episodes and watched episodes across regular seasons (specials excluded from totals but still markable), watched and total per season, and the next episode to watch. The next episode SHALL be the first unwatched episode after the latest watched episode in season-episode order; when nothing is watched it SHALL be the first episode of the first regular season; when every regular episode is watched there SHALL be no next episode.

#### Scenario: Middle of a season
- **WHEN** S1 E1 to E6 are watched of a ten-episode season
- **THEN** next up is S1 E7 and progress is 6 of 10 for that season

#### Scenario: Season boundary
- **WHEN** every episode of season 1 is watched and none of season 2
- **THEN** next up is S2 E1

#### Scenario: Gaps are skipped forward
- **WHEN** S1 E1, E2 and E5 are watched
- **THEN** next up is S1 E6, not E3

#### Scenario: Nothing watched
- **WHEN** no episodes are watched
- **THEN** next up is S1 E1

#### Scenario: Complete
- **WHEN** all regular episodes are watched
- **THEN** there is no next episode and progress equals the total

### Requirement: Continue watching card
Title and library item screens for a TV series with at least one episode watched SHALL show a "Continue watching" card with the next episode (season, number and name when known) and an overall progress bar with "N of M episodes". Tapping the card SHALL open the season screen of the next episode. When the series is complete the card SHALL say so instead of a next episode.

#### Scenario: Card shows next episode
- **WHEN** the owner opens a series with S2 E5 as the next episode
- **THEN** the card reads "Next up · S2 E5" with the episode name and the progress bar reflects watched over total

#### Scenario: Card opens the season
- **WHEN** the owner taps the card
- **THEN** the season 2 screen opens

#### Scenario: Series complete
- **WHEN** all regular episodes are watched
- **THEN** the card reads "All caught up" with a full progress bar
