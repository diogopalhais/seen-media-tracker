## MODIFIED Requirements

### Requirement: Tab bar navigation
The app SHALL have four top-level destinations, Library, Discover, Search and Settings, presented as a tab bar fixed to the bottom of the screen on compact widths (under 768 px) and as a leading sidebar on wider layouts. Each tab SHALL show an icon and a text label, the active tab SHALL be distinguished by a highlighted pill and a filled icon variant, and each tab SHALL retain its own navigation stack and scroll position when the owner switches between tabs.

#### Scenario: Switching tabs preserves state
- **WHEN** the owner opens a title from Discover, switches to Library and then back to Discover
- **THEN** the title screen is still shown at the same scroll position

#### Scenario: Reselecting the active tab
- **WHEN** the owner taps the already active tab while deep in its stack
- **THEN** the tab pops to its root screen

#### Scenario: Wide layout
- **WHEN** the viewport is 768 px or wider
- **THEN** the destinations appear in a sidebar and no bottom tab bar is shown
