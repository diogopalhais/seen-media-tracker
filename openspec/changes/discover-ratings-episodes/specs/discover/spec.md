## Purpose

Gives the owner something to browse when no search is active: what is trending this week and what is popular right now, for movies and TV series, straight from TMDB.

## ADDED Requirements

### Requirement: Discover endpoint
The API SHALL expose a private endpoint returning three lists of normalised titles in the same shape as search results (including community rating and library membership): trending movies and TV series for the current week, popular movies, and popular TV series. Each list SHALL contain at most 20 titles. Responses SHALL be served from a server-side cache for up to one hour so repeated opens do not call TMDB.

#### Scenario: Three lists returned
- **WHEN** the discover endpoint is requested
- **THEN** the response contains `trending`, `popularMovies` and `popularTv` arrays, each with at most 20 titles carrying media type, year, poster, community rating and `inLibrary`

#### Scenario: Cached within the hour
- **WHEN** the endpoint is requested twice within an hour
- **THEN** the metadata provider is called only once

#### Scenario: Provider unavailable
- **WHEN** TMDB cannot be reached
- **THEN** the API responds `502` with error code `upstream_unavailable`

### Requirement: Discover rows in the Search tab
When the search field is empty the Search tab SHALL show three horizontally scrolling poster rows titled "Trending this week", "Popular Movies" and "Popular TV Series". Each card SHALL show the poster, title, year, media-type badge where the row mixes types, the TMDB community rating and a "Seen" indicator when the title is in the library. Tapping a card SHALL open the title detail screen. While loading, skeleton cards SHALL be shown; on failure an inline message with Retry SHALL replace the rows.

#### Scenario: Browsing without a query
- **WHEN** the Search tab is opened with an empty field
- **THEN** the three rows are shown with poster cards that scroll horizontally

#### Scenario: Card opens details
- **WHEN** the owner taps a card
- **THEN** the title detail screen for that movie or series opens

#### Scenario: Discover failure
- **WHEN** the discover request fails
- **THEN** an inline message with a Retry action is shown in place of the rows and the search field remains usable
