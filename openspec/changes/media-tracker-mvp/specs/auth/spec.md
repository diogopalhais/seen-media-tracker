## Purpose

Protects the tracker so that only its owner can read the private library and record watches, using a single pre-provisioned account with password login and revocable session tokens.

## ADDED Requirements

### Requirement: Single pre-provisioned owner account
The system SHALL have exactly one owner identity, provisioned through server configuration rather than through the API or UI. The system SHALL NOT expose any endpoint or screen for account registration, password reset by email, or account enumeration.

#### Scenario: Registration is not available
- **WHEN** a client sends a request to create an account at any path
- **THEN** the API responds with a `404` not-found error and no account is created

#### Scenario: Owner credentials come from configuration
- **WHEN** the API starts without an owner password hash configured
- **THEN** the API refuses to start and logs a clear configuration error

### Requirement: Password login issues a session token
The API SHALL expose a login endpoint that accepts the owner password and, on success, returns an opaque session token together with its expiry timestamp. On failure it SHALL return a generic `401` error that does not reveal whether the password was close, and SHALL take a comparable amount of time as a successful attempt.

#### Scenario: Correct password
- **WHEN** the owner submits the correct password to the login endpoint
- **THEN** the API responds `200` with a session token and an ISO 8601 `expiresAt` timestamp

#### Scenario: Incorrect password
- **WHEN** a client submits an incorrect password
- **THEN** the API responds `401` with error code `invalid_credentials` and no token is issued

#### Scenario: Malformed login request
- **WHEN** a client submits a login request without a password field or with a non-string password
- **THEN** the API responds `400` with error code `validation_error`

### Requirement: Session tokens are opaque, hashed at rest and time-limited
Session tokens SHALL contain at least 128 bits of cryptographically random entropy, SHALL be stored server-side only in hashed form, and SHALL expire 30 days after issuance. Presenting an expired, revoked or unknown token SHALL be treated identically to presenting no token.

#### Scenario: Valid token grants access
- **WHEN** a private endpoint is requested with a valid, unexpired session token in the `Authorization: Bearer` header
- **THEN** the request is processed as the owner

#### Scenario: Expired token is rejected
- **WHEN** a private endpoint is requested with a token whose expiry has passed
- **THEN** the API responds `401` with error code `unauthorized`

#### Scenario: Unknown token is rejected
- **WHEN** a private endpoint is requested with a syntactically valid token that was never issued
- **THEN** the API responds `401` with error code `unauthorized`

#### Scenario: Token storage cannot yield the token
- **WHEN** the server-side session store is inspected
- **THEN** the original token value cannot be recovered from the stored representation

### Requirement: Logout revokes the current session
The API SHALL expose a logout endpoint that immediately revokes the session token used to call it. Revocation SHALL be permanent.

#### Scenario: Token unusable after logout
- **WHEN** the owner calls logout with a valid token and then reuses that token on a private endpoint
- **THEN** the logout responds `204` and the subsequent request responds `401`

### Requirement: Private endpoints require authentication
Every API endpoint except login, the health endpoint and the public recent-media endpoint SHALL require a valid session token. Unauthenticated requests SHALL receive `401` with a `WWW-Authenticate: Bearer` header and SHALL NOT reveal whether the requested resource exists.

#### Scenario: Missing Authorization header
- **WHEN** a private endpoint is requested without an `Authorization` header
- **THEN** the API responds `401` with `WWW-Authenticate: Bearer` and error code `unauthorized`

#### Scenario: Wrong authentication scheme
- **WHEN** a private endpoint is requested with an `Authorization` header that is not a Bearer token
- **THEN** the API responds `401` with error code `unauthorized`

### Requirement: Login is protected against brute force
The API SHALL limit failed login attempts per client IP address to at most 5 within a 15 minute window. Once exceeded, further login attempts from that address SHALL be rejected with `429` and a `Retry-After` header until the window has elapsed. A successful login SHALL reset the counter for that address.

#### Scenario: Sixth failed attempt is throttled
- **WHEN** a client has failed to log in 5 times within 15 minutes and attempts a sixth login
- **THEN** the API responds `429` with error code `rate_limited` and a `Retry-After` header, without verifying the password

#### Scenario: Window expiry restores access
- **WHEN** the 15 minute window has elapsed since the throttled address's first failed attempt
- **THEN** a new login attempt from that address is evaluated normally

### Requirement: Session introspection
The API SHALL expose an endpoint returning the current session's state so that the app can decide whether to show the login screen without triggering an error.

#### Scenario: Authenticated session lookup
- **WHEN** the session endpoint is called with a valid token
- **THEN** the API responds `200` with `authenticated: true` and the session's `expiresAt`

#### Scenario: Unauthenticated session lookup
- **WHEN** the session endpoint is called without a valid token
- **THEN** the API responds `401` with error code `unauthorized`

### Requirement: Web app login flow
The web app SHALL present a login screen with a single password field whenever no valid session exists, SHALL persist the session token on the device after a successful login so that reopening the installed app does not require logging in again until expiry or logout, and SHALL return to the login screen and discard the stored token whenever the API answers `401`.

#### Scenario: First launch
- **WHEN** the app is opened with no stored session token
- **THEN** the login screen is shown and no private data is requested

#### Scenario: Successful login lands on Library
- **WHEN** the owner enters the correct password and submits
- **THEN** the app stores the token, navigates to the Library tab and loads the library

#### Scenario: Relaunch with stored token
- **WHEN** the installed app is relaunched while a stored token is still valid
- **THEN** the Library tab is shown directly without a login prompt

#### Scenario: Server rejects stored token
- **WHEN** any private request answers `401`
- **THEN** the app clears the stored token and shows the login screen with an explanatory message

#### Scenario: Wrong password feedback
- **WHEN** the owner submits an incorrect password
- **THEN** the login screen shows an inline error, keeps focus in the password field and does not clear it

#### Scenario: Log out from Settings
- **WHEN** the owner taps "Log Out" in Settings and confirms
- **THEN** the app calls the logout endpoint, discards the stored token and shows the login screen
