## Purpose

Lets the owner's installed devices receive a notification when a followed series has a new episode.

## ADDED Requirements

### Requirement: Push configuration discovery
The API SHALL expose a private endpoint returning whether push is enabled on the server and, when enabled, the VAPID public key the client must subscribe with. Push is enabled only when the server is configured with a VAPID key pair and subject.

#### Scenario: Configured server
- **WHEN** the owner requests the push configuration on a server with VAPID keys
- **THEN** the response reports enabled with the public key

#### Scenario: Unconfigured server
- **WHEN** the server has no VAPID keys
- **THEN** the response reports disabled with no key, and subscription and test endpoints respond `503` with error code `push_disabled`

### Requirement: Subscription registration
The API SHALL accept a Web Push subscription (endpoint URL and `p256dh`/`auth` keys, optional user agent) from the owner and store it, replacing any existing record with the same endpoint. The API SHALL remove a subscription by endpoint. Both operations SHALL be idempotent and require authentication.

#### Scenario: Register and re-register
- **WHEN** the same subscription is registered twice
- **THEN** exactly one record exists and both requests succeed

#### Scenario: Remove
- **WHEN** the owner removes a registered endpoint, then removes it again
- **THEN** both requests succeed and no record remains

#### Scenario: Validation
- **WHEN** the endpoint is not a URL or a key is missing
- **THEN** the API responds `400` with error code `validation_error`

### Requirement: Test notification
The API SHALL send a test notification to every registered device on request and report how many sends succeeded, failed, and how many dead subscriptions were removed.

#### Scenario: Test send
- **WHEN** the owner requests a test with two registered devices, one of which the push service reports as gone
- **THEN** one notification is delivered, the gone subscription is deleted, and the response reports sent 1, removed 1

### Requirement: New-episode notifier
The API SHALL run a notifier at start and then hourly that refreshes stale running series and, for each library series whose last aired episode aired within the past 7 days, on or before today, and differs from the last announced episode, marks that episode as announced and, if the owner has not watched it (same rule as the `new_episode` release alert), sends one notification to every device with the series title, the episode code and name, and a link to the series in the app. Subscriptions that the push service reports as gone SHALL be removed. When a series is first added to the library its current last episode SHALL count as already announced. When push is disabled the notifier SHALL do nothing.

#### Scenario: Newly aired episode
- **WHEN** a followed series gains an aired, unwatched episode since the last announcement
- **THEN** one notification is sent and a second run sends nothing more

#### Scenario: Already watched
- **WHEN** the new episode was ticked before the notifier ran
- **THEN** it is marked announced and no notification is sent

#### Scenario: Old episodes
- **WHEN** the unannounced episode aired more than 7 days ago
- **THEN** nothing is sent

#### Scenario: Newly added series
- **WHEN** the owner adds a series whose latest episode aired yesterday
- **THEN** the notifier does not announce that episode

#### Scenario: Provider outage
- **WHEN** the metadata provider is unavailable during a run
- **THEN** the run completes with the stored snapshots and does not crash the server

### Requirement: Notification handling in the app
The service worker SHALL display incoming push notifications with the given title, body and app icon, grouped per series, and SHALL open or focus the app at the notification's link when tapped. The worker SHALL keep the existing offline caching (precached shell, image cache, network-first private reads) and the prompt-based update flow.

#### Scenario: Tap opens the series
- **WHEN** the owner taps a new-episode notification
- **THEN** the app opens on that series' library page

### Requirement: Notifications settings
Settings SHALL show a "Notifications" section when the server has push enabled and the device supports it: a "New episodes" toggle reflecting whether this device is subscribed, and a "Send test notification" row while enabled. On iOS Safari outside the installed app the section SHALL explain that the app must be installed to the Home Screen first. When permission is denied the toggle SHALL be disabled with an explanation. On launch the app SHALL re-register an existing subscription so a server restore or an expired record heals itself.

#### Scenario: Enable
- **WHEN** the owner turns the toggle on and grants permission
- **THEN** the device is subscribed and registered and the toggle stays on

#### Scenario: Disable
- **WHEN** the owner turns the toggle off
- **THEN** the subscription is removed on the device and the server

#### Scenario: Not installed on iOS
- **WHEN** the Settings screen opens in iOS Safari (not installed)
- **THEN** the section shows the install hint instead of a toggle
