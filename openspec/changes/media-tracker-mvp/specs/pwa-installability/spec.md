## Purpose

Makes the web app installable on smartphones and desktops with a standalone, app-like experience, keeps it up to date after deployments, and behaves gracefully when the network is unavailable.

## ADDED Requirements

### Requirement: Web app manifest
The app SHALL serve a web app manifest with name and short name "Seen", a description, `start_url` and `scope` at the app root, `display: standalone`, a stable `id`, theme and background colours matching the app, and icons of at least 192 and 512 px in both `any` and `maskable` purposes. The manifest SHALL be linked from the HTML document.

#### Scenario: Installability audit passes
- **WHEN** the deployed app is audited with a browser installability checker
- **THEN** all manifest and service worker installability criteria pass

#### Scenario: Android install prompt
- **WHEN** the app is opened in Chrome on Android and the browser's install criteria are met
- **THEN** the browser offers to install the app and, once installed, it launches in standalone mode with the Seen icon

### Requirement: iOS home screen metadata
The HTML document SHALL include a 180 px Apple touch icon, a viewport declaration with `viewport-fit=cover`, Apple web-app-capable metadata and a status-bar style so that the installed app blends its status bar with the navigation bar.

#### Scenario: Added to iPhone home screen
- **WHEN** the owner adds the app to the home screen from Safari and launches it
- **THEN** it opens full screen without Safari controls, shows the Seen icon and the status bar area matches the app's background

### Requirement: Install guidance in Settings
Settings SHALL contain an "Install" section. On browsers that expose an install prompt it SHALL show an "Install Seen" button that triggers the native prompt. On iOS Safari it SHALL show step-by-step instructions to use Share and then Add to Home Screen. The section SHALL be hidden when the app is already running in standalone mode.

#### Scenario: Chromium browser
- **WHEN** the install prompt event is available
- **THEN** tapping "Install Seen" shows the browser's install dialog

#### Scenario: iOS Safari
- **WHEN** the app runs in Safari on iOS and not standalone
- **THEN** the section shows the Share then Add to Home Screen instructions

#### Scenario: Already installed
- **WHEN** the app runs in standalone display mode
- **THEN** the Install section is not shown

### Requirement: Offline-capable app shell
A service worker SHALL precache the application shell (HTML, scripts, styles, fonts, icons) so that the app opens without a network connection. The app SHALL check for a new version on every launch and, when one is found, SHALL either apply it before the shell is shown or show a non-blocking "Update available" banner whose action reloads into the new version. The shell SHALL never remain on a stale version indefinitely.

#### Scenario: Offline launch
- **WHEN** the installed app is launched with no connectivity
- **THEN** the app shell loads and shows the last cached library with an offline indicator

#### Scenario: Deployment picked up
- **WHEN** a new frontend version has been deployed and the owner opens the app
- **THEN** the new version is active on this launch or the update banner appears and reloading activates it

### Requirement: Runtime caching strategy
Poster and backdrop images SHALL be cached with a cache-first strategy limited to 500 entries and 30 days. Private library and detail GET responses SHALL be served network-first with fallback to the last cached response. Requests that change data SHALL never be cached or replayed, and when offline the app SHALL report the failure and keep the owner's unsaved input.

#### Scenario: Revisiting cached posters offline
- **WHEN** the owner scrolls the library offline
- **THEN** previously seen posters render from cache and unseen ones show a placeholder

#### Scenario: Offline write attempt
- **WHEN** the owner saves a watch while offline
- **THEN** the sheet shows "You're offline" and its fields keep their values

#### Scenario: Reconnect after offline browsing
- **WHEN** connectivity returns
- **THEN** the offline indicator disappears and visible data refreshes automatically

### Requirement: Standalone navigation behaviour
In standalone mode all in-app navigation SHALL stay inside the app window, and links to external sites such as TMDB SHALL open in the system browser. Every in-app route SHALL be reachable by direct URL so that reloading or launching into a deep link works.

#### Scenario: External link
- **WHEN** the owner taps the TMDB link on a title while in standalone mode
- **THEN** the link opens in the device browser and the app remains on the title screen

#### Scenario: Deep link reload
- **WHEN** a library item URL is loaded directly or reloaded
- **THEN** the app renders that item screen instead of a not-found page
