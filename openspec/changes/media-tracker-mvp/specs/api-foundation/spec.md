## Purpose

Defines the cross-cutting behaviour every API endpoint shares: versioning, request validation, error format, health reporting, CORS, rate limiting and transport security.

## ADDED Requirements

### Requirement: Versioned base path
All API routes SHALL live under `/api/v1`. The health endpoint SHALL live at `/health`. Requests to unknown paths SHALL receive a JSON `404` error.

#### Scenario: Unknown route
- **WHEN** a client requests a path that is not defined
- **THEN** the API responds `404` with error code `not_found` in the standard error shape

### Requirement: Standard JSON error shape
Every error response SHALL be JSON with an `error` object containing a snake_case `code`, a human-readable `message`, and, for validation errors, a `details` array of `{ path, message }` entries. The API SHALL use `400 validation_error`, `401 unauthorized`, `404 not_found`, `405 method_not_allowed`, `413 payload_too_large`, `429 rate_limited`, `500 internal_error` and `502 upstream_unavailable`. Responses SHALL never include stack traces or internal exception messages.

#### Scenario: Validation error detail
- **WHEN** a request body has an invalid `rating`
- **THEN** the response is `400` with code `validation_error` and a `details` entry whose `path` is `rating`

#### Scenario: Unexpected failure
- **WHEN** an unhandled exception occurs while processing a request
- **THEN** the response is `500` with code `internal_error`, a generic message and no internal details, and the exception is logged with the request id

### Requirement: Request validation
Query parameters, path parameters and JSON bodies SHALL be validated against the endpoint's schema before any processing. Unknown body fields SHALL be ignored. JSON bodies larger than 100 KB SHALL be rejected. Requests with a body SHALL declare `Content-Type: application/json`.

#### Scenario: Oversized body
- **WHEN** a request body exceeds 100 KB
- **THEN** the API responds `413` with error code `payload_too_large`

#### Scenario: Wrong content type
- **WHEN** a body is sent with a non-JSON content type
- **THEN** the API responds `400` with error code `validation_error`

### Requirement: Health endpoint
`GET /health` SHALL be unauthenticated and SHALL respond `200` with `status: "ok"`, the running application version and uptime in seconds when the database is reachable, and `503` with `status: "degraded"` otherwise. It SHALL never be cached.

#### Scenario: Healthy
- **WHEN** the database responds to a trivial query
- **THEN** the health endpoint responds `200` with `status: "ok"`

#### Scenario: Database unavailable
- **WHEN** the database connection cannot be established or the query fails
- **THEN** the health endpoint responds `503` with `status: "degraded"`

### Requirement: CORS policy
Private routes SHALL allow cross-origin requests only from a configured allowlist of origins, SHALL permit the `Authorization` and `Content-Type` request headers and the `GET`, `POST`, `PATCH`, `DELETE` and `OPTIONS` methods, and SHALL answer preflight requests with a cache lifetime of at least 10 minutes. Requests from origins not in the allowlist SHALL receive no CORS headers. Public routes SHALL follow the public feed's wildcard policy.

#### Scenario: Allowed app origin
- **WHEN** the web app's origin sends a preflight for a `PATCH` with `Authorization`
- **THEN** the response allows that origin, method and header

#### Scenario: Unknown origin
- **WHEN** a browser page on an unlisted origin calls a private endpoint
- **THEN** the response carries no `Access-Control-Allow-Origin` header and the browser blocks the read

### Requirement: Rate limiting behind a reverse proxy
Rate limits SHALL be keyed by client IP address taken from the forwarded-for header only when the request arrives from the trusted reverse proxy, and from the socket address otherwise. `429` responses SHALL include `Retry-After` and the `RateLimit-Limit`, `RateLimit-Remaining` and `RateLimit-Reset` headers.

#### Scenario: Forwarded address trusted
- **WHEN** the reverse proxy forwards two clients with different forwarded-for addresses
- **THEN** each client has its own rate-limit budget

#### Scenario: Limit headers present
- **WHEN** a request is rejected with `429`
- **THEN** `Retry-After` and the `RateLimit-*` headers are present

### Requirement: Transport and response security headers
The API SHALL be served only over HTTPS at its public hostname, SHALL send `Strict-Transport-Security` with a max-age of at least 180 days, `X-Content-Type-Options: nosniff`, and `Cache-Control: no-store` on private responses, and SHALL NOT disclose server software or version headers.

#### Scenario: Private response headers
- **WHEN** a private endpoint responds
- **THEN** the response includes `Cache-Control: no-store`, `X-Content-Type-Options: nosniff` and `Strict-Transport-Security`

### Requirement: Request correlation
Every response SHALL include an `X-Request-Id` header, echoing a client-supplied value when present and otherwise generating one, and every log line for that request SHALL include the same id.

#### Scenario: Client-supplied id
- **WHEN** a request carries `X-Request-Id: abc123`
- **THEN** the response carries `X-Request-Id: abc123` and logs for the request include `abc123`

### Requirement: Data representation conventions
Identifiers SHALL be opaque strings. Timestamps SHALL be ISO 8601 in UTC with a `Z` suffix. Calendar dates SHALL be `YYYY-MM-DD` strings. Paginated collections SHALL return `{ items, nextCursor }` where `nextCursor` is null on the last page. Field names SHALL be camelCase.

#### Scenario: Timestamp format
- **WHEN** a response includes a creation time
- **THEN** it is formatted like `2026-09-11T10:15:30.000Z`

#### Scenario: Last page
- **WHEN** a paginated request returns the final page
- **THEN** `nextCursor` is null
