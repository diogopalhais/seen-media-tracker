## Why

Release alerts only help when the app is open. The owner wants to know a followed series has a new episode without opening Seen, and the installed PWA can receive Web Push on iOS, Android and desktop. The detection logic already exists in the release alerts; this change delivers it as a notification.

## What Changes

- **Push subscriptions**: Settings gains a "New episodes" notification toggle. Enabling it asks for permission (from a tap, as iOS requires), subscribes the device and registers the subscription with the API. Disabling removes it. A "Send test notification" row confirms the path end to end.
- **Notifier**: the API runs an hourly job that refreshes running series and sends one notification per newly aired, unwatched episode to every registered device, remembering what it announced so nothing repeats.
- **Service worker** handles `push` and `notificationclick`, opening the series in the app. The worker moves from a generated file to our own source so the existing caching rules and the update flow are kept.
- Server-side push is optional: without VAPID keys the API reports push as disabled and the Settings section stays hidden.

## Capabilities

### New Capabilities

- `push-notifications`: subscription registration and removal, push configuration discovery, test sends, the hourly new-episode notifier, and the client-side permission and toggle flow.

## Impact

- Shared: push schemas and a `push_disabled` error code.
- API: `web-push` dependency, `VAPID_*` env (optional), migration `0004` (`push_subscriptions` table and announced-episode markers on `media_items`), routes under `/api/v1/push`, a scheduler started with the server.
- Web: custom service worker (`src/sw.ts`, injectManifest), `lib/push.ts`, Settings "Notifications" section, subscription re-sync on launch.
