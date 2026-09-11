## MODIFIED Requirements

### Requirement: Public recent-media endpoint
The API SHALL expose an unauthenticated `GET` endpoint under the versioned public path that returns the most recently watched titles. It SHALL accept an optional `limit` query parameter (integer 1 to 50, default 10). Watch entries and episode watches both count as watch events. Each title SHALL appear at most once, represented by its most recent event. Items SHALL be ordered by date watched descending then by creation time descending. Each item SHALL contain: media type, title, year, poster URL, displayed rating (0.5 to 5 or null), date watched, season (TV only, nullable), episode (TV only, nullable, set when the most recent event was an episode watch) and a URL to the title's page on TMDB. The response SHALL include a `generatedAt` timestamp.

#### Scenario: Default limit
- **WHEN** the endpoint is requested without a limit
- **THEN** at most 10 items are returned, most recently watched first

#### Scenario: Episode watch is the latest event
- **WHEN** the owner's most recent activity is marking S2 E6 of a series
- **THEN** that series appears first with `season: 2` and `episode: 6`

#### Scenario: Rewatched title appears once
- **WHEN** a title has been watched three times
- **THEN** it appears once with the date and rating of its most recent watch

#### Scenario: Limit out of range
- **WHEN** `limit` is `0`, `51`, negative or not an integer
- **THEN** the API responds `400` with error code `validation_error`

#### Scenario: Empty library
- **WHEN** no watches have been logged
- **THEN** the API responds `200` with an empty `items` array
