/// <reference lib="webworker" />
import { PushNotificationSchema } from '@seen/shared';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Parameters<typeof precacheAndRoute>[0];
};

const DAY = 24 * 60 * 60;
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

// App shell: precached, with deep links served from index.html. Old caches are dropped on update.
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
clientsClaim();
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/api\//] }),
);

// Update flow is prompt-based: the page asks us to activate once the owner accepts the banner.
self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING') void self.skipWaiting();
});

// Posters, covers, backdrops and stills (TMDB and IGDB): cache first, bounded.
registerRoute(
  ({ url }) => url.hostname === 'image.tmdb.org' || url.hostname === 'images.igdb.com',
  new CacheFirst({
    cacheName: 'tmdb-images',
    plugins: [
      new ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: 30 * DAY, purgeOnQuotaError: true }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);

// Private library reads: network first, last good response when offline. Auth and public routes are
// excluded, and only GET is ever cached.
registerRoute(
  ({ url, request }) =>
    request.method === 'GET' &&
    url.href.startsWith(`${API_BASE}/api/v1/`) &&
    !/^\/api\/v1\/(auth|public)\//.test(url.pathname),
  new NetworkFirst({
    cacheName: 'seen-api',
    networkTimeoutSeconds: 10,
    plugins: [
      new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 7 * DAY, purgeOnQuotaError: true }),
      new CacheableResponsePlugin({ statuses: [200] }),
    ],
  }),
  'GET',
);

// Web Push: show what the API sent, after validating it, grouped per series by tag.
self.addEventListener('push', (event) => {
  let raw: unknown;
  try {
    raw = event.data?.json();
  } catch {
    return;
  }
  const parsed = PushNotificationSchema.safeParse(raw);
  if (!parsed.success) return;
  const n = parsed.data;
  event.waitUntil(
    self.registration.showNotification(n.title, {
      body: n.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: n.tag,
      data: { url: n.url },
    }),
  );
});

// Tapping a notification focuses an open app window and navigates it, or opens a new one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = (event.notification.data as { url?: string } | undefined)?.url ?? '/';
  const target = new URL(path, self.location.origin).href;
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = clients[0];
      if (existing) {
        await existing.focus();
        if ('navigate' in existing) await existing.navigate(target);
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});
