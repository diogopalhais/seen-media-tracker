## MODIFIED Requirements

### Requirement: Title details
The private title details endpoint SHALL return, in addition to the existing fields: the top billed cast (up to 15 people with name, character and photo URL when available), key crew (directors and writers for movies, creators for series, each with their job), the networks (series) and production companies, the provider's status label (for example "Returning Series", "Ended", "Released"), and for series the last episode to air and the next episode to air (season, episode number, name and air date), each null when unknown. Every person and company SHALL carry its TMDB id.

#### Scenario: Movie details include people and companies
- **WHEN** the owner requests details for a movie
- **THEN** the response lists cast with characters, crew including the director, the production companies and the status

#### Scenario: Series details include broadcast information
- **WHEN** the owner requests details for a returning series
- **THEN** the response includes the networks, the creators, status "Returning Series", the last aired episode and the next episode with its air date

#### Scenario: Missing enrichment does not fail the request
- **WHEN** the provider returns no credits, companies or episode information for a title
- **THEN** the response still succeeds with empty lists and null values

### Requirement: Title screen enrichment
Title and library item screens SHALL show a horizontal cast shelf (photo, name, character) when cast is known and a details list with: status and, for series, the next episode (or the latest aired one) with a human date; network(s); studio(s); director(s) or creator(s). Rows with no data SHALL be omitted. Movies that are released SHALL not show a status row.

#### Scenario: Returning series
- **WHEN** the owner opens a series whose next episode airs in five days
- **THEN** the details list reads "Returning" with "Next · S3 E1 · <name> · in 5 days", and shows the network and creators

#### Scenario: Ended series
- **WHEN** the owner opens a series that has ended
- **THEN** the status row reads "Ended" with the last episode and its date

#### Scenario: Released movie
- **WHEN** the owner opens a released movie
- **THEN** no status row is shown; director, writers and studios are listed and the cast shelf appears above the details
