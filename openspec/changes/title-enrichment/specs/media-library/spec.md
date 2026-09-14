## ADDED Requirements

### Requirement: Release alerts
Each library summary of a series SHALL carry a release alert or null. The alert SHALL be `new_episode` when the series' last aired episode aired within the past 30 days, on or before today, and the owner has neither marked that episode watched nor logged a watch for that season or the whole series dated on or after its air date. Otherwise the alert SHALL be `upcoming` when the series' next episode airs within the next 14 days. The alert SHALL name the episode (season, number, name, air date). Movies SHALL have no alert.

#### Scenario: New episode not yet watched
- **WHEN** the owner tracks a series by episodes and an episode aired three days ago that is not marked
- **THEN** the library summary carries a `new_episode` alert for that episode

#### Scenario: Watched through a season log
- **WHEN** the owner logged "Season 2" on or after the last episode's air date instead of ticking episodes
- **THEN** no `new_episode` alert is raised

#### Scenario: Old backlog is not an alert
- **WHEN** the last episode aired more than 30 days ago and is unwatched
- **THEN** no alert is raised

#### Scenario: Upcoming episode
- **WHEN** the owner is caught up and the next episode airs in eight days
- **THEN** the summary carries an `upcoming` alert with the air date

### Requirement: Releases endpoint
The API SHALL expose a private endpoint listing library series with a release alert, `new_episode` first and then `upcoming`, each ordered by air date (newest aired first, soonest upcoming first), limited to 20 items, using the same summary shape as the library list.

#### Scenario: Releases list
- **WHEN** the owner requests releases with one series having a new episode and one an upcoming episode
- **THEN** the response lists both in that order with their alerts

#### Scenario: Nothing to report
- **WHEN** no series has an alert
- **THEN** the response is an empty list

### Requirement: Snapshot refresh of running series
When the library list or releases are requested, the API SHALL refresh the stored snapshot (status, last and next episode, rating, seasons count) of library series whose status is not ended or canceled and whose snapshot is older than six hours, at most six per request, and SHALL wait no more than about two seconds for refreshes before responding with what it has. Provider failures SHALL not fail the request. Series whose status is "Ended" or "Canceled" SHALL not be refreshed.

#### Scenario: Stale running series is refreshed
- **WHEN** a returning series was last refreshed seven hours ago and the library is opened
- **THEN** the provider is consulted for that series and the stored status and episodes are updated

#### Scenario: Ended series is left alone
- **WHEN** a series with status "Ended" was last refreshed a week ago
- **THEN** the provider is not called for it

#### Scenario: Provider outage
- **WHEN** the provider is unavailable during a refresh
- **THEN** the library responds `200` from the stored snapshots

## MODIFIED Requirements

### Requirement: Library item snapshot
The stored snapshot of a title SHALL additionally record the provider's status label and, for series, the last and next episode to air, and SHALL expose them on the library item detail. Snapshots record when they were last refreshed.

#### Scenario: Snapshot exposes broadcast state
- **WHEN** the owner opens a library series
- **THEN** the item includes its status and next episode even when the provider is unavailable

### Requirement: Library screen releases
The Library screen SHALL show a "New & upcoming" shelf above the grid when at least one series has a release alert and no filter is active, with each card showing the poster, title, the episode and a human date, tapping through to the item. Cards in the grid with a `new_episode` alert SHALL carry a "New episode" badge.

#### Scenario: Shelf appears
- **WHEN** a followed series has an unwatched new episode
- **THEN** the shelf lists it with "S2 E9 · 3 days ago" and the grid card carries the badge

#### Scenario: Nothing new
- **WHEN** no series has an alert
- **THEN** the shelf is not rendered and the grid starts at the top
