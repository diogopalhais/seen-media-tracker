import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/** CSP `sha256-…` sources for every inline `<script>` in the built index.html (the pre-paint theme script). */
function inlineScriptHashes(html: string): string[] {
  const hashes: string[] = [];
  for (const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
    const body = match[1] ?? '';
    if (body.trim()) hashes.push(`'sha256-${createHash('sha256').update(body).digest('base64')}'`);
  }
  return hashes;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Cloudflare `_headers`: strict CSP that only allows connecting to the configured API origin. */
function cloudflareHeaders(apiOrigin: string): Plugin {
  return {
    name: 'seen:cloudflare-headers',
    apply: 'build',
    closeBundle() {
      const outDir = resolve(import.meta.dirname, 'dist');
      const indexPath = resolve(outDir, 'index.html');
      const scriptSrc = [
        "'self'",
        ...(existsSync(indexPath) ? inlineScriptHashes(readFileSync(indexPath, 'utf8')) : []),
      ];
      const csp = [
        "default-src 'self'",
        `script-src ${scriptSrc.join(' ')}`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https://image.tmdb.org",
        // The service worker fetches posters with fetch(), which CSP governs under connect-src, not img-src.
        `connect-src 'self' ${apiOrigin} https://image.tmdb.org`,
        "font-src 'self'",
        "manifest-src 'self'",
        "worker-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        'upgrade-insecure-requests',
      ].join('; ');
      const headers = `/*
  Content-Security-Policy: ${csp}
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Cross-Origin-Opener-Policy: same-origin

/index.html
  Cache-Control: no-cache

/
  Cache-Control: no-cache

/sw.js
  Cache-Control: no-cache

/manifest.webmanifest
  Cache-Control: no-cache

/assets/*
  Cache-Control: public, max-age=31536000, immutable
`;
      mkdirSync(outDir, { recursive: true });
      writeFileSync(resolve(outDir, '_headers'), headers);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, '');
  const apiBase = (env.VITE_API_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const apiOrigin = new URL(apiBase).origin;

  return {
    plugins: [
      react(),
      tailwindcss(),
      cloudflareHeaders(apiOrigin),
      VitePWA({
        registerType: 'prompt',
        injectRegister: false,
        includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
        manifest: {
          id: '/',
          name: 'Seen',
          short_name: 'Seen',
          description: 'Track the movies and TV series you have watched and rate them.',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#0d0d0f',
          theme_color: '#0d0d0f',
          lang: 'en',
          categories: ['entertainment', 'lifestyle'],
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            {
              src: 'icons/icon-maskable-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: 'icons/icon-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,webmanifest}'],
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [/^\/api\//],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: false,
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/image\.tmdb\.org\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'tmdb-images',
                expiration: {
                  maxEntries: 500,
                  maxAgeSeconds: 30 * 24 * 60 * 60,
                  purgeOnQuotaError: true,
                },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              // Private library reads: network first, fall back to the last good response when offline.
              // Auth and public routes are excluded; non-GET requests are never matched by runtime caching.
              urlPattern: new RegExp(`^${escapeRegExp(apiBase)}/api/v1/(?!auth/|public/).*`),
              handler: 'NetworkFirst',
              method: 'GET',
              options: {
                cacheName: 'seen-api',
                networkTimeoutSeconds: 10,
                expiration: {
                  maxEntries: 300,
                  maxAgeSeconds: 7 * 24 * 60 * 60,
                  purgeOnQuotaError: true,
                },
                cacheableResponse: { statuses: [200] },
              },
            },
          ],
        },
        devOptions: { enabled: false },
      }),
    ],
    define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.1.0') },
    server: { port: 5173, strictPort: true },
    build: { sourcemap: true, target: 'es2022' },
  };
});
