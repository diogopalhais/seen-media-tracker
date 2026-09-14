## Context

Builds on `title-enrichment`, which stores the last aired episode per series and refreshes running series lazily. Web Push needs: a VAPID key pair on the server, a subscription per device, encrypted delivery (the `web-push` library), and `push` handling in the service worker. The PWA plugin currently generates the worker; custom handlers require our own worker source.

## Goals / Non-Goals

**Goals:** one toggle, reliable delivery of new-episode notifications, zero duplicates, iOS-compatible flow, no extra infrastructure.

**Non-Goals:** per-series opt-out, upcoming-episode reminders, rich notifications (images, actions), notification history, multi-user targeting.

## Decisions

- **Scheduler in-process.** The API is a single always-on container on Coolify, so a `setInterval` (hourly, first run one minute after boot) is enough. `runOnce` is a plain method so tests drive it deterministically with the fake clock. Provider or push failures are logged and never propagate.
- **Announced marker on `media_items`** (`notified_episode_season/number`). The rule "announce when last aired ≠ announced" is a two-column comparison in SQL, cheaper and simpler than an announcements table. New items copy the current last episode into the marker at insert, so adding a series never triggers a notification about its already-known state.
- **Watched check reuses the release-alert predicate**, so the notification and the badge agree. Episodes older than 7 days are marked announced silently, bounding the first run after deploy.
- **`Pusher` interface** around `web-push` with a fake in tests; 404/410 from the push service mean the device unsubscribed and the record is deleted. TTL 24 h, normal urgency.
- **Optional configuration.** `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` are validated together; absent means push disabled (`/push/config` says so, other push routes return `503 push_disabled`). `pnpm --filter @seen/api vapid` prints a fresh pair.
- **Service worker as source** (`src/sw.ts`, `injectManifest`) replicating the generated rules: precache + navigation fallback (denylist `/api/`), CacheFirst for TMDB images (500 entries, 30 days), NetworkFirst for private GETs (10 s timeout, 300 entries, 7 days), `SKIP_WAITING` message for the prompt-based update flow, `clientsClaim`. Push payloads are validated with the shared schema before display. `notificationclick` focuses an open client and navigates it, or opens a new window.
- **Client flow.** `pushSupport()` distinguishes supported, needs-install (iOS Safari not standalone) and unsupported. Enabling asks permission, subscribes with the server key, and registers; disabling unregisters then unsubscribes. On each launch an existing subscription is re-registered (idempotent PUT), which heals server restores and iOS re-issued endpoints.

## Risks / Trade-offs

- [VAPID keys rotated] → every device must re-enable; document that the keys are secrets to back up with the database.
- [iOS drops unused subscriptions] → the launch re-sync re-registers what the device still has; if iOS revoked it, the toggle shows off and one tap re-enables.
- [Two API instances would double-send] → the deployment runs one replica; noted in the README.
- [Custom worker drifts from the plugin's defaults] → the rules are listed in the spec and checked in the browser (precache manifest present, image caching still works).
