## MODIFIED Requirements

### Requirement: Web library item detail screen
The item detail screen SHALL show the backdrop or poster, title, year, media type, genres, runtime or season count, the people's rating, and overview. It SHALL lead with a watched status block: when the item has at least one watch entry it reads "Watched" with the most recent date (and the number of times when more than one), shows the owner's rating when rated or a "Rate" action otherwise, and the rating is set inline (a strip of ten numbers that saves on tap) rather than in a modal, and offers a low-emphasis "Log another watch" action; when it has no watch entry (a series tracked only by episodes) it SHALL offer a primary "Mark as Watched" action. The watch history list SHALL follow, where each entry shows date watched, season (if any), rating and note, with per-entry Edit and Delete actions (Delete confirmed with a destructive style), returning to the Library after deleting the last activity. A link to the title on TMDB SHALL open outside the app.

#### Scenario: Watched status with rating
- **WHEN** the owner opens an item with two entries, the latest rated 7
- **THEN** the status reads "Watched" with the latest date and "2 times", and shows the 7/10 star badge

#### Scenario: Watched but unrated offers Rate
- **WHEN** the latest entries carry no rating
- **THEN** the status shows a "Rate" action which reveals an inline strip of ten numbers; tapping one stores the rating on the most recent entry immediately and the strip folds away

#### Scenario: Log another watch is secondary
- **WHEN** the owner wants to record a rewatch with a date or note
- **THEN** a low-emphasis "Log another watch" action opens the full log-watch sheet

#### Scenario: Delete entry with confirmation
- **WHEN** the owner chooses Delete on an entry
- **THEN** a confirmation with a destructive-styled Delete action is shown and the entry is removed only after confirming

### Requirement: Web library screen
The Library tab SHALL show the owner's items as a poster grid ordered by most recent activity. The navigation bar SHALL show a single filter button in its trailing corner that opens a sheet containing a Type control (All, Movies, TV) and a Sort control (Recent, Title, Rating), with an indicator whenever a non-default filter or sort is active; the chosen filters SHALL persist while the app stays open. Each poster card SHALL show the title, year, and one ratings line with the people's rating first and the owner's star rating second when rated; series tracked by episode SHALL show the number of episodes watched. Tapping an item SHALL open its detail screen. When the library is empty a message SHALL point the owner to the Search tab.

#### Scenario: Ratings line order
- **WHEN** an item has a people's rating of 8.4 and an owner rating of 7
- **THEN** the card shows the people's figure before the star badge on the same line

#### Scenario: Filter from the header
- **WHEN** the owner taps the filter button and selects TV
- **THEN** only TV series are shown and the filter button shows an active indicator

#### Scenario: Empty library
- **WHEN** the library has no items
- **THEN** an empty-state message with a "Search" action is shown
