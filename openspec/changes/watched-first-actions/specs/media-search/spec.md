## MODIFIED Requirements

### Requirement: Title detail screen from search
Opening a search or discover result SHALL show the title's details (backdrop or poster, title, year, media type, genres, runtime or season count, people's rating with vote count, overview). The primary action SHALL be "Mark as Watched", which logs a watch dated today with no rating in one tap and then shows the watched status (date, optional Rate action or the owner's rating badge, low-emphasis "Log another watch") in its place; a low-emphasis "Log with details" action SHALL open the full log-watch sheet for a different date, season or note. If the title is already in the library the watched status SHALL be shown instead of the primary action, with a link to the library item. For TV series the screen SHALL list the seasons, each navigating to that season's detail screen.

#### Scenario: One-tap watched
- **WHEN** the owner taps "Mark as Watched" on a title not yet in the library
- **THEN** a watch dated today with no rating is created and the screen shows "Watched" with today's date and a "Rate" action

#### Scenario: Rate after watching
- **WHEN** the owner taps "Rate" and picks 8 in the inline strip
- **THEN** the most recent entry is updated immediately and the 8/10 pill replaces the Rate action

#### Scenario: Log with details
- **WHEN** the owner taps "Log with details"
- **THEN** the log-watch sheet opens pre-filled with the title

#### Scenario: Already seen title
- **WHEN** the owner opens a title that is already in the library
- **THEN** the screen shows the watched status and a link to the library item

### Requirement: Community rating presentation
Search results, discover cards, title screens and library screens SHALL present the TMDB community rating as a people's rating: a people icon, the average to one decimal and, where space allows, the vote count, with no source label. The source attribution required by TMDB's terms SHALL remain in Settings.

#### Scenario: Card shows a quiet people's rating
- **WHEN** a search result has 8.4 from 2,900 votes
- **THEN** the row shows a people icon with "8.4" (and "2.9K" where there is room) and no "TMDB" label

#### Scenario: Attribution preserved
- **WHEN** the owner opens Settings
- **THEN** the TMDB attribution notice is still present
