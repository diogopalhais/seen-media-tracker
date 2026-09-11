## Purpose

Exposes the owner's most recently watched titles as a public, read-only, cacheable JSON feed so an external website can display them without credentials.

## ADDED Requirements

### Requirement: Public recent-media endpoint
The API SHALL expose an unauthenticated `GET` endpoint under the versioned public path that returns the most recently watched titles. It SHALL accept an optional `limit` query parameter (integer 1 to 50, default 10). Each title SHALL appear at most once, represented by its most recent watch. Items SHALL be ordered by date watched descending then by creation time descending. Each item SHALL contain: media type, title, year, poster URL, displayed rating (integer 1 to 10 or null), date watched, season (TV only, nullable) and a URL to the title's page on TMDB. The response SHALL include a `generatedAt` timestamp.

#### Scenario: Default limit
- **WHEN** the endpoint is requested without a limit
- **THEN** at most 10 items are returned, most recently watched first

#### Scenario: Rewatched title appears once
- **WHEN** a title has been watched three times
- **THEN** it appears once with the date and rating of its most recent watch

#### Scenario: Limit out of range
- **WHEN** `limit` is `0`, `51`, negative or not an integer
- **THEN** the API responds `400` with error code `validation_error`

#### Scenario: Empty library
- **WHEN** no watches have been logged
- **THEN** the API responds `200` with an empty `items` array

### Requirement: Public feed excludes private data
The public feed SHALL NOT include notes, internal identifiers, session information or any field not listed in the endpoint definition.

#### Scenario: Notes are withheld
- **WHEN** a watch entry has a note
- **THEN** the corresponding public item contains no note field

### Requirement: Public feed is cross-origin readable
Public endpoints SHALL respond with `Access-Control-Allow-Origin: *` and SHALL allow only `GET`, `HEAD` and `OPTIONS` methods.

#### Scenario: Browser fetch from another site
- **WHEN** a script on the owner's personal website fetches the feed
- **THEN** the browser permits reading the response because of the wildcard origin header

#### Scenario: Write method refused
- **WHEN** a `POST` request is sent to the public endpoint
- **THEN** the API responds `405` with error code `method_not_allowed`

### Requirement: Public feed is cacheable
Public responses SHALL include `Cache-Control: public, max-age=300, stale-while-revalidate=600` and a strong `ETag`. A request carrying a matching `If-None-Match` SHALL receive `304` with no body.

#### Scenario: Conditional request
- **WHEN** a client repeats the request with the `ETag` from the previous response and the data has not changed
- **THEN** the API responds `304`

#### Scenario: Data changed
- **WHEN** a new watch has been logged since the client's cached response
- **THEN** the API responds `200` with a different `ETag`

### Requirement: Public feed is rate limited
Public endpoints SHALL be limited to 60 requests per minute per client IP address. Excess requests SHALL receive `429` with a `Retry-After` header.

#### Scenario: Burst over limit
- **WHEN** a client sends a 61st request within one minute
- **THEN** the API responds `429` with error code `rate_limited`

### Requirement: Public feed contract stability
Within API version 1 the public feed SHALL only gain fields; existing fields SHALL NOT be renamed, removed or change type. Breaking changes SHALL be introduced under a new version path.

#### Scenario: Consumer written against v1
- **WHEN** the tracker is updated with new features
- **THEN** a consumer reading only the documented v1 fields continues to work unchanged
