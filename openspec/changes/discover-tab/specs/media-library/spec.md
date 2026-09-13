## MODIFIED Requirements

### Requirement: Web library screen
The Library tab SHALL show the owner's items as a poster grid ordered by most recent activity, with a single filter button in the navigation bar's trailing corner opening a sheet with Type and Sort controls and an indicator when a non-default filter is active. Each card SHALL present a clear hierarchy: the title in body size (up to two lines), then a line with the year and progress (times watched or episodes watched), then a separate ratings line with the people's rating first and the owner's star rating second. Tapping an item SHALL open its detail screen. When the library is empty a message SHALL point the owner to the Search tab.

#### Scenario: Card hierarchy
- **WHEN** a library card renders
- **THEN** title, year line and ratings line are three distinct lines with visible spacing between them

#### Scenario: Empty library
- **WHEN** the library has no items
- **THEN** an empty-state message with a "Search" action is shown
