## MODIFIED Requirements

### Requirement: Discover rows in the Search tab
The Discover tab SHALL show three horizontally scrolling poster rows titled "Trending this week", "Popular Movies" and "Popular TV Series", each with a one-line subtitle. Each card SHALL show the poster, a title in body size, a short description or the year, and a ratings line with the media-type badge where the row mixes types and the people's rating, plus a "Seen" indicator when the title is in the library. Tapping a card SHALL open the title detail screen within the Discover tab. While loading, skeleton cards SHALL be shown; on failure an inline message with Retry SHALL replace the rows.

#### Scenario: Browsing the Discover tab
- **WHEN** the owner opens the Discover tab
- **THEN** the three rows are shown with poster cards that scroll horizontally

#### Scenario: Card opens details in place
- **WHEN** the owner taps a card
- **THEN** the title detail screen opens inside the Discover tab and Back returns to Discover

#### Scenario: Discover failure
- **WHEN** the discover request fails
- **THEN** an inline message with a Retry action is shown in place of the rows
