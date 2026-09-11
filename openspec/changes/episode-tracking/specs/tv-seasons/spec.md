## MODIFIED Requirements

### Requirement: Season detail screen
The season detail screen SHALL show the series title with the season name as the screen title, the season poster, air year, episode count, per-season progress ("N of M watched" with a progress bar) and overview, followed by the list of episodes. Each episode row SHALL show the still image, episode number, name, air date, runtime, community rating and a checkmark control reflecting whether the episode is watched; tapping the checkmark SHALL toggle it, and tapping the row SHALL expand it to reveal the overview plus a "Watched up to here" action that marks this and all earlier episodes of the season. The screen SHALL offer "Mark season watched" (or "Mark season unwatched" when complete) and a "Log Season N" action that opens the log-watch sheet with that season preselected. The screen SHALL be reachable from the seasons list on both the search title screen and the library item screen, and SHALL be reachable by direct URL.

#### Scenario: Episodes listed with checkmarks
- **WHEN** the owner opens a season with ten episodes of which three are watched
- **THEN** ten rows are shown in order, the first three with filled checkmarks, and the header reads "3 of 10 watched"

#### Scenario: Toggle an episode
- **WHEN** the owner taps the checkmark on episode 4
- **THEN** episode 4 becomes watched immediately and the progress reads "4 of 10 watched"

#### Scenario: Watched up to here
- **WHEN** the owner expands episode 7 and taps "Watched up to here"
- **THEN** episodes 1 to 7 are all watched

#### Scenario: Mark season watched
- **WHEN** the owner taps "Mark season watched"
- **THEN** every episode of the season is watched and the button becomes "Mark season unwatched"

#### Scenario: Log the season
- **WHEN** the owner taps "Log Season 2"
- **THEN** the log-watch sheet opens for the series with season 2 preselected

#### Scenario: Deep link
- **WHEN** a season URL is loaded directly
- **THEN** the season screen renders with a back control to the series
