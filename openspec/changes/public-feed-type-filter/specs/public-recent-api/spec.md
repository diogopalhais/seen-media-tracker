## MODIFIED Requirements

### Requirement: Public recent feed
The public recent feed SHALL accept an optional `type` query parameter with values `all` (default), `movie` or `tv`, and SHALL return only titles of that media type, most recent first, with `limit` applied after filtering. Invalid values SHALL be rejected with a validation error. Caching and ETag behaviour SHALL apply per URL, so the filtered lists are cached independently.

#### Scenario: Latest movies
- **WHEN** a consumer requests `?type=movie&limit=5`
- **THEN** the response lists at most five movies and no series

#### Scenario: Latest shows
- **WHEN** a consumer requests `?type=tv`
- **THEN** only series are listed, each with its latest season or episode event

#### Scenario: Invalid type
- **WHEN** a consumer requests `?type=book`
- **THEN** the API responds `400` with error code `validation_error`
