## MODIFIED Requirements

### Requirement: Web search screen
The Search tab SHALL show a search field at the top of the screen, request results automatically no more than 400 ms after typing stops, and present results as a list where each row shows the poster thumbnail, the title in body size, the year with a media-type badge on a second line, the people's rating on a third line, and a "Seen" indicator for titles already in the library. Tapping a result SHALL open the title detail screen. When no query is entered the screen SHALL show a short prompt explaining that movies and TV series can be searched.

#### Scenario: Results appear while typing
- **WHEN** the owner types "sever" and pauses
- **THEN** results for the current text appear within one network round-trip after the pause without pressing a submit button

#### Scenario: Empty state
- **WHEN** the Search tab is opened with no query entered
- **THEN** a short prompt explains that movies and TV series can be searched

#### Scenario: Clearing the field
- **WHEN** the owner clears the search field
- **THEN** the results list is emptied and the empty-state prompt is shown

#### Scenario: Search failure
- **WHEN** the search request fails
- **THEN** an inline message with a Retry action is shown in place of results
