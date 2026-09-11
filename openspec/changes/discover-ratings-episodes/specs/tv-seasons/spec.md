## Purpose

Lets the owner drill from a TV series into a season and see every episode's details, and log a watch of that season from there.

## ADDED Requirements

### Requirement: Season details endpoint
The API SHALL expose a private endpoint returning details of one season of a TV series by TMDB id and season number: season number, name, overview, air date, poster URL, and its episodes in ascending order, each with episode number, name, overview, air date, runtime in minutes (nullable), still image URL (nullable) and TMDB community rating average and vote count. Responses SHALL be served from a server-side cache for up to one hour.

#### Scenario: Season with episodes
- **WHEN** season 1 of an existing series is requested
- **THEN** the response lists its episodes in ascending episode order with names, air dates and ratings

#### Scenario: Unknown season
- **WHEN** a season number the series does not have is requested
- **THEN** the API responds `404` with error code `not_found`

#### Scenario: Invalid parameters
- **WHEN** the season number is negative or not an integer
- **THEN** the API responds `400` with error code `validation_error`

### Requirement: Season detail screen
The season detail screen SHALL show the series title with the season name as the screen title, the season poster, air year, episode count and overview, followed by the list of episodes. Each episode row SHALL show the still image, episode number, name, air date, runtime and community rating, and tapping a row SHALL expand it to reveal the overview. The screen SHALL offer a "Log Season N" action that opens the log-watch sheet with that season preselected. The screen SHALL be reachable from the seasons list on both the search title screen and the library item screen, and SHALL be reachable by direct URL.

#### Scenario: Episodes listed
- **WHEN** the owner opens a season with ten episodes
- **THEN** ten rows are shown in order with still, number, name, air date, runtime and rating

#### Scenario: Expand an episode
- **WHEN** the owner taps an episode row
- **THEN** the row expands to show the episode overview and tapping again collapses it

#### Scenario: Log the season
- **WHEN** the owner taps "Log Season 2"
- **THEN** the log-watch sheet opens for the series with season 2 preselected

#### Scenario: Deep link
- **WHEN** a season URL is loaded directly
- **THEN** the season screen renders with a back control to the series
