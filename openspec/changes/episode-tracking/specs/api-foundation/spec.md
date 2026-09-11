## MODIFIED Requirements

### Requirement: CORS policy
Private routes SHALL allow cross-origin requests only from a configured allowlist of origins, SHALL permit the `Authorization` and `Content-Type` request headers and the `GET`, `POST`, `PUT`, `PATCH`, `DELETE` and `OPTIONS` methods, and SHALL answer preflight requests with a cache lifetime of at least 10 minutes. Requests from origins not in the allowlist SHALL receive no CORS headers. Public routes SHALL follow the public feed's wildcard policy.

#### Scenario: Allowed app origin
- **WHEN** the web app's origin sends a preflight for a `PUT` with `Authorization`
- **THEN** the response allows that origin, method and header

#### Scenario: Unknown origin
- **WHEN** a browser page on an unlisted origin calls a private endpoint
- **THEN** the response carries no `Access-Control-Allow-Origin` header and the browser blocks the read
