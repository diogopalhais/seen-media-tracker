import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { episodeWatches, mediaItems, pushSubscriptions, watchEntries } from '../src/db/schema.js';
import {
  createTestContext,
  json,
  logWatch,
  type TestContext,
  VAPID_PUBLIC_KEY_FOR_TESTS,
} from './helpers.js';

let ctx: TestContext;
let token: string;
beforeAll(async () => {
  ctx = await createTestContext({ refresh: { budgetMs: 5000 } });
  token = await ctx.login();
});
afterAll(() => ctx.close());
beforeEach(async () => {
  await ctx.db.db.delete(pushSubscriptions);
  await ctx.db.db.delete(episodeWatches);
  await ctx.db.db.delete(watchEntries);
  await ctx.db.db.delete(mediaItems);
  ctx.pusher.sent = [];
  ctx.pusher.gone.clear();
  ctx.pusher.failing = false;
  ctx.provider.unavailable = false;
  ctx.clock.current = new Date('2026-09-10T12:00:00.000Z');
});

const SEVERANCE = 95396;
const sub = (n: number) => ({
  endpoint: `https://push.example.com/device-${n}`,
  keys: { p256dh: `p256dh-${n}`, auth: `auth-${n}` },
  userAgent: 'iPhone',
});
const subscribe = (body: unknown) =>
  ctx.request('/api/v1/push/subscriptions', { method: 'PUT', token, json: body });
const unsubscribe = (endpoint: string) =>
  ctx.request('/api/v1/push/subscriptions', { method: 'DELETE', token, json: { endpoint } });
const rows = () => ctx.db.db.select().from(pushSubscriptions);

describe('push configuration and subscriptions', () => {
  it('reports the public key when configured', async () => {
    const res = await ctx.request('/api/v1/push/config', { token });
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ enabled: true, publicKey: VAPID_PUBLIC_KEY_FOR_TESTS });
  });

  it('registers a subscription idempotently and updates its keys', async () => {
    expect((await subscribe(sub(1))).status).toBe(204);
    expect((await subscribe({ ...sub(1), keys: { p256dh: 'new', auth: 'auth-1' } })).status).toBe(
      204,
    );
    const all = await rows();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ endpoint: sub(1).endpoint, p256dh: 'new', userAgent: 'iPhone' });
  });

  it('removes a subscription idempotently', async () => {
    await subscribe(sub(1));
    expect((await unsubscribe(sub(1).endpoint)).status).toBe(204);
    expect((await unsubscribe(sub(1).endpoint)).status).toBe(204);
    expect(await rows()).toHaveLength(0);
  });

  it('validates the subscription shape', async () => {
    const res = await subscribe({ endpoint: 'not-a-url', keys: { p256dh: 'x' } });
    expect(res.status).toBe(400);
    expect((await json(res)).error.code).toBe('validation_error');
  });

  it('requires authentication', async () => {
    expect((await ctx.request('/api/v1/push/config')).status).toBe(401);
    expect(
      (await ctx.request('/api/v1/push/subscriptions', { method: 'PUT', json: sub(1) })).status,
    ).toBe(401);
  });

  it('sends a test notification and prunes gone devices', async () => {
    await subscribe(sub(1));
    await subscribe(sub(2));
    ctx.pusher.gone.add(sub(2).endpoint);
    const res = await ctx.request('/api/v1/push/test', { method: 'POST', token });
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ sent: 1, failed: 0, removed: 1 });
    expect(ctx.pusher.sent[0]?.payload).toMatchObject({ kind: 'test', url: '/settings' });
    expect((await rows()).map((r) => r.endpoint)).toEqual([sub(1).endpoint]);
  });
});

describe('push disabled', () => {
  it('reports disabled and refuses subscriptions with 503', async () => {
    const off = await createTestContext({ push: false });
    try {
      const t = await off.login();
      expect(await json(await off.request('/api/v1/push/config', { token: t }))).toEqual({
        enabled: false,
        publicKey: null,
      });
      const res = await off.request('/api/v1/push/subscriptions', {
        method: 'PUT',
        token: t,
        json: sub(1),
      });
      expect(res.status).toBe(503);
      expect((await json(res)).error.code).toBe('push_disabled');
      expect((await off.notifier.runOnce()).announced).toBe(0);
    } finally {
      await off.close();
    }
  });
});

describe('new-episode notifier', () => {
  /** Simulate a series that was announced up to S2 E8 before S2 E9 (aired 5 days ago) appeared. */
  const behindByOne = () =>
    ctx.db.db.update(mediaItems).set({ notifiedEpisodeSeason: 2, notifiedEpisodeNumber: 8 });

  it('announces an unwatched new episode exactly once', async () => {
    await subscribe(sub(1));
    await logWatch(ctx, token, {
      mediaType: 'tv',
      tmdbId: SEVERANCE,
      watchedOn: '2026-09-01',
      season: 1,
    });
    await behindByOne();
    const first = await ctx.notifier.runOnce();
    expect(first.announced).toBe(1);
    expect(ctx.pusher.sent).toHaveLength(1);
    expect(ctx.pusher.sent[0]?.payload).toMatchObject({
      kind: 'new_episode',
      title: 'Severance',
      body: 'New episode · S2 E9 · The After Hours',
      tag: expect.stringMatching(/^episode-/),
    });
    expect(String(ctx.pusher.sent[0]?.payload.url)).toMatch(/^\/library\/[0-9a-f-]{36}$/);
    expect((await ctx.notifier.runOnce()).announced).toBe(0);
    expect(ctx.pusher.sent).toHaveLength(1);
  });

  it('marks the episode of a muted series without notifying', async () => {
    await subscribe(sub(1));
    const { body } = await logWatch(ctx, token, {
      mediaType: 'tv',
      tmdbId: SEVERANCE,
      watchedOn: '2026-09-01',
      season: 1,
    });
    await ctx.request(`/api/v1/library/${body.item.id}`, {
      method: 'PATCH',
      token,
      json: { muted: true },
    });
    await behindByOne();
    expect((await ctx.notifier.runOnce()).announced).toBe(0);
    expect(ctx.pusher.sent).toHaveLength(0);
    // Following again does not replay the episode that arrived while muted.
    await ctx.request(`/api/v1/library/${body.item.id}`, {
      method: 'PATCH',
      token,
      json: { muted: false },
    });
    expect((await ctx.notifier.runOnce()).announced).toBe(0);
  });

  it('marks a watched episode without notifying', async () => {
    await subscribe(sub(1));
    await ctx.request('/api/v1/watches/episodes', {
      method: 'PUT',
      token,
      json: { tmdbId: SEVERANCE, episodes: [{ seasonNumber: 2, episodeNumber: 9 }], watched: true },
    });
    await behindByOne();
    expect((await ctx.notifier.runOnce()).announced).toBe(0);
    expect(ctx.pusher.sent).toHaveLength(0);
    const [row] = await ctx.db.db.select().from(mediaItems);
    expect(row).toMatchObject({ notifiedEpisodeSeason: 2, notifiedEpisodeNumber: 9 });
  });

  it('never announces the episode a newly added series already had', async () => {
    await subscribe(sub(1));
    await logWatch(ctx, token, {
      mediaType: 'tv',
      tmdbId: SEVERANCE,
      watchedOn: '2026-09-01',
      season: 1,
    });
    expect((await ctx.notifier.runOnce()).announced).toBe(0);
  });

  it('ignores episodes older than the announce window', async () => {
    await subscribe(sub(1));
    await logWatch(ctx, token, {
      mediaType: 'tv',
      tmdbId: SEVERANCE,
      watchedOn: '2026-09-01',
      season: 1,
    });
    await behindByOne();
    ctx.clock.current = new Date('2026-09-20T12:00:00.000Z'); // aired 15 days ago
    expect((await ctx.notifier.runOnce()).announced).toBe(0);
    expect(ctx.pusher.sent).toHaveLength(0);
  });

  it('survives a provider outage and prunes gone devices while announcing', async () => {
    await subscribe(sub(1));
    await subscribe(sub(2));
    await logWatch(ctx, token, {
      mediaType: 'tv',
      tmdbId: SEVERANCE,
      watchedOn: '2026-09-01',
      season: 1,
    });
    await behindByOne();
    ctx.pusher.gone.add(sub(2).endpoint);
    ctx.provider.unavailable = true;
    ctx.clock.advance(7 * 60 * 60 * 1000); // makes the snapshot stale so the refresh is attempted
    expect((await ctx.notifier.runOnce()).announced).toBe(1);
    expect((await rows()).map((r) => r.endpoint)).toEqual([sub(1).endpoint]);
  });
});
