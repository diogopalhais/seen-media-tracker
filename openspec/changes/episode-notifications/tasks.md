## 1. Contracts

- [x] 1.1 Shared push schemas (`PushConfig`, `PushSubscriptionRequest`, `PushUnsubscribeRequest`, `PushNotification`, `PushSendResult`), `push_disabled` error code, announce window constant

## 2. API

- [x] 2.1 Optional `VAPID_*` config with joint validation; `vapid` key generator script; `.env.example`, compose and README updates
- [x] 2.2 `push_subscriptions` table and announced markers on `media_items`; migration `0004`; `upsertItem` seeds the marker on insert
- [x] 2.3 `Pusher` (web-push) + `PushRepository` + `PushService.broadcast` with dead-subscription pruning; routes `GET /push/config`, `PUT|DELETE /push/subscriptions`, `POST /push/test`
- [x] 2.4 `EpisodeNotifier.runOnce` (refresh, pending announcements, watched check, send, mark) and hourly `start`; wired in the server entry point
- [x] 2.5 Tests: config, subscribe/unsubscribe idempotency, validation, test send with a gone device, notifier scenarios (new, watched, old, newly added, disabled, outage)

## 3. Web

- [x] 3.1 Switch the PWA plugin to `injectManifest` with `src/sw.ts` (precache, navigation fallback, image and API caching, SKIP_WAITING, push, notificationclick); separate worker tsconfig in typecheck
- [x] 3.2 `lib/push.ts` (support detection, enable/disable, launch re-sync) and API client methods; re-sync from the root layout
- [x] 3.3 Settings "Notifications" section with a `Switch`, install hint, denied state and test send
- [x] 3.4 Unit tests for push helpers; build and browser check of the worker (precache manifest, image cache, SW registration)

## 4. Verification

- [x] 4.1 Lint, typecheck, all tests, production build; local review before push
