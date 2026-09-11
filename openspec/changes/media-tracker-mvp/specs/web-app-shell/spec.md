## Purpose

Defines the frontend's navigation structure, visual system aligned with Apple's Human Interface Guidelines, appearance modes, accessibility and responsive behaviour so the app feels at home on iPhone while working in any modern browser.

## ADDED Requirements

### Requirement: Tab bar navigation
The app SHALL have three top-level destinations, Library, Search and Settings, presented as a tab bar fixed to the bottom of the screen on compact widths (under 768 px) and as a leading sidebar on wider layouts. Each tab SHALL show an icon and a text label, the active tab SHALL be distinguished by the tint colour and a filled icon variant, and each tab SHALL retain its own navigation stack and scroll position when the owner switches between tabs.

#### Scenario: Switching tabs preserves state
- **WHEN** the owner opens a library item, switches to Search and then back to Library
- **THEN** the item detail screen is still shown at the same scroll position

#### Scenario: Reselecting the active tab
- **WHEN** the owner taps the already active tab while deep in its stack
- **THEN** the tab pops to its root screen

#### Scenario: Wide layout
- **WHEN** the viewport is 768 px or wider
- **THEN** the destinations appear in a sidebar and no bottom tab bar is shown

### Requirement: Navigation bars with large titles
Each tab's root screen SHALL display a large title that collapses into a compact centred title in a translucent navigation bar as the content scrolls. Pushed screens SHALL show a back control labelled with the previous screen's title, or "Back" when the title is long, and the browser's back button or gesture SHALL perform the same navigation.

#### Scenario: Title collapses on scroll
- **WHEN** the owner scrolls the Library grid down
- **THEN** the large title shrinks into the navigation bar and the bar becomes translucent over content

#### Scenario: Browser back matches in-app back
- **WHEN** the owner uses the browser back gesture on a pushed screen
- **THEN** the app returns to the previous screen exactly as tapping the back control would

### Requirement: Sheets and alerts for modal tasks
Creation and editing tasks SHALL be presented as sheets rising from the bottom edge with a grabber, dismissible by a Cancel control, a downward swipe or the Escape key. Destructive confirmations SHALL use an alert or action sheet whose destructive action is styled red and whose cancel action is the safe default.

#### Scenario: Sheet dismissal
- **WHEN** the owner swipes a sheet downward or presses Escape
- **THEN** the sheet closes, prompting first if it holds unsaved changes

#### Scenario: Destructive confirmation styling
- **WHEN** a delete confirmation appears
- **THEN** the Delete action is red, Cancel is the default focused action, and pressing Escape cancels

### Requirement: System typography
Text SHALL use the platform system font stack so that Apple devices render San Francisco and other platforms their system UI font. The type scale SHALL mirror iOS text styles (Large Title 34, Title 1 28, Title 2 22, Title 3 20, Headline 17 semibold, Body 17, Callout 16, Subheadline 15, Footnote 13, Caption 1 12, Caption 2 11 points) expressed in relative units so browser text-size preferences scale the interface.

#### Scenario: Body text size
- **WHEN** default browser settings are used
- **THEN** body copy renders at 17 px and large titles at 34 px

#### Scenario: Enlarged text preference
- **WHEN** the browser default font size is raised to 200 percent
- **THEN** text scales up, nothing is clipped and no horizontal scrolling appears

### Requirement: Semantic colours with light and dark appearance
Colours SHALL be defined as semantic tokens (primary and secondary label, primary and secondary background, grouped background, separator, tint, destructive) whose values follow the iOS system palette for light and dark appearance. The app SHALL follow the device appearance by default and SHALL offer a manual override (System, Light, Dark) in Settings that persists on the device. Text SHALL meet a 4.5:1 contrast ratio against its background in both appearances.

#### Scenario: Follows system appearance
- **WHEN** the device switches from light to dark mode while the app is open
- **THEN** the app switches appearance without reload and the browser theme colour updates

#### Scenario: Manual override
- **WHEN** the owner selects Dark in Settings on a light-mode device
- **THEN** the app renders in dark appearance and remembers the choice on relaunch

### Requirement: Grouped inset lists
Settings and detail screens SHALL use grouped inset lists: rounded containers on the grouped background, hairline separators aligned with the row text, chevron disclosure indicators on rows that navigate, and rows of at least 44 px height with optional header and footer text.

#### Scenario: Navigable row
- **WHEN** a row leads to another screen
- **THEN** it shows a trailing chevron and the entire row is tappable

### Requirement: Touch targets and spacing
Every interactive control SHALL have a hit area of at least 44 by 44 CSS pixels. Layout SHALL follow an 8 px spacing grid with 16 px horizontal margins on compact widths and 20 px on wider layouts.

#### Scenario: Rating buttons
- **WHEN** the ten rating buttons render on a 320 px wide screen
- **THEN** each button still has a hit area of at least 44 by 44 px, wrapping onto a second row if necessary

#### Scenario: Small icon button
- **WHEN** an icon-only button renders with a 24 px glyph
- **THEN** its tappable area is still at least 44 by 44 px

### Requirement: Safe area awareness
Content and bars SHALL respect the device safe-area insets. The tab bar and sheets SHALL extend their background into the bottom inset while keeping controls above it, the navigation bar SHALL extend behind the status bar, and no content SHALL be hidden behind bars or the home indicator.

#### Scenario: iPhone with home indicator
- **WHEN** the installed app runs on a device with a home indicator
- **THEN** tab bar icons sit above the indicator and the bar's background reaches the screen edge

#### Scenario: Landscape notch
- **WHEN** the device is rotated to landscape
- **THEN** content keeps clear of the notch on the leading edge

### Requirement: Feedback and motion
Loading states SHALL use skeleton placeholders or an indeterminate indicator inline rather than blocking the whole screen when cached content exists. Screen and sheet transitions SHALL last between 250 and 350 ms with an ease-out curve, and all non-essential motion SHALL be disabled when the reduced-motion preference is set. Failures SHALL be shown inline or as a non-blocking banner with a retry action.

#### Scenario: Reduced motion
- **WHEN** the reduced-motion preference is enabled
- **THEN** screens and sheets appear without sliding or scaling animation

#### Scenario: Background refresh failure
- **WHEN** a refresh of already displayed data fails
- **THEN** the existing content stays visible and a dismissible banner offers Retry

### Requirement: Accessibility
Every control SHALL have an accessible name, keyboard focus SHALL be visible, and the rating control SHALL be operable by keyboard and announce its value as "N out of 10". Poster images SHALL carry the title as alternative text and media type SHALL never be conveyed by colour alone.

#### Scenario: Keyboard rating
- **WHEN** the rating control is focused and the right arrow key is pressed
- **THEN** the rating increases by one and the new value is announced

#### Scenario: Screen reader on a search result
- **WHEN** a screen reader reads a search result row
- **THEN** it announces title, year and media type as text

### Requirement: Responsive layout
The interface SHALL render correctly from 320 px to desktop widths. The poster grid SHALL adapt its column count to the available width, and the page SHALL never scroll horizontally.

#### Scenario: Narrow phone
- **WHEN** the viewport is 320 px wide
- **THEN** the grid shows two poster columns and no horizontal scroll bar appears

#### Scenario: Desktop
- **WHEN** the viewport is 1280 px wide
- **THEN** content is centred with a maximum readable width and the sidebar navigation is shown

### Requirement: Mobile-friendly text input
Text inputs SHALL use a font size of at least 16 px so iOS does not zoom on focus, SHALL declare the appropriate input type (search, date, text) and SHALL not autocapitalise or autocorrect the password field.

#### Scenario: Focus search field on iOS
- **WHEN** the search field is focused on an iPhone
- **THEN** the page does not zoom and the keyboard shows a Search key
