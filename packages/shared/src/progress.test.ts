import { describe, expect, it } from 'vitest';
import { computeProgress, formatEpisode, needsCurrentSeasonEpisodes } from './progress.js';

const seasons = [
  { seasonNumber: 0, name: 'Specials', episodeCount: 3, airDate: null, isSpecials: true },
  { seasonNumber: 1, name: 'Season 1', episodeCount: 10, airDate: '2022-01-01', isSpecials: false },
  { seasonNumber: 2, name: 'Season 2', episodeCount: 8, airDate: '2024-01-01', isSpecials: false },
];
const w = (s: number, e: number) => ({
  seasonNumber: s,
  episodeNumber: e,
  watchedOn: '2026-09-01',
});

describe('computeProgress', () => {
  it('starts at S1 E1 when nothing is watched', () => {
    const p = computeProgress(seasons, []);
    expect(p).toMatchObject({
      watched: 0,
      total: 18,
      complete: false,
      nextUp: { seasonNumber: 1, episodeNumber: 1 },
      lastWatched: null,
    });
  });

  it('points to the episode after the latest watched one', () => {
    const p = computeProgress(
      seasons,
      [1, 2, 3, 4, 5, 6].map((e) => w(1, e)),
    );
    expect(p.nextUp).toEqual({ seasonNumber: 1, episodeNumber: 7 });
    expect(p.perSeason[0]).toEqual({
      seasonNumber: 1,
      watched: 6,
      watchedAired: 6,
      aired: 10,
      total: 10,
    });
    expect(p.watched).toBe(6);
  });

  it('crosses the season boundary', () => {
    const p = computeProgress(
      seasons,
      Array.from({ length: 10 }, (_, i) => w(1, i + 1)),
    );
    expect(p.nextUp).toEqual({ seasonNumber: 2, episodeNumber: 1 });
  });

  it('skips forward past gaps', () => {
    const p = computeProgress(seasons, [w(1, 1), w(1, 2), w(1, 5)]);
    expect(p.nextUp).toEqual({ seasonNumber: 1, episodeNumber: 6 });
    expect(p.lastWatched).toEqual({ seasonNumber: 1, episodeNumber: 5 });
  });

  it('is complete when every regular episode is watched, ignoring specials', () => {
    const all = [
      ...Array.from({ length: 10 }, (_, i) => w(1, i + 1)),
      ...Array.from({ length: 8 }, (_, i) => w(2, i + 1)),
      w(0, 1),
    ];
    const p = computeProgress(seasons, all);
    expect(p.complete).toBe(true);
    expect(p.nextUp).toBeNull();
    expect(p.watched).toBe(18);
  });

  it('ignores watches for seasons TMDB no longer lists', () => {
    const p = computeProgress(seasons, [w(9, 1)]);
    expect(p.watched).toBe(0);
    expect(p.nextUp).toEqual({ seasonNumber: 1, episodeNumber: 1 });
  });

  it('formats pointers', () => {
    expect(formatEpisode({ seasonNumber: 2, episodeNumber: 6 })).toBe('S2 E6');
  });
});

describe('computeProgress on an airing series', () => {
  // Season 2 has 8 episodes listed, 5 of which have aired.
  const lastAired = { seasonNumber: 2, episodeNumber: 5, airDate: '2026-09-18' };
  const s1 = Array.from({ length: 10 }, (_, i) => w(1, i + 1));

  it('counts only aired episodes and never points past them', () => {
    const p = computeProgress(seasons, [...s1, w(2, 1), w(2, 2)], { lastAired });
    expect(p).toMatchObject({
      total: 18,
      aired: 15,
      watched: 12,
      watchedAired: 12,
      behind: 3,
      remaining: 3,
      status: 'behind',
      complete: false,
      exact: true,
      nextUp: { seasonNumber: 2, episodeNumber: 3 },
    });
    expect(p.perSeason[1]).toEqual({
      seasonNumber: 2,
      watched: 2,
      watchedAired: 2,
      aired: 5,
      total: 8,
    });
  });

  it('is up to date, not watched, once every aired episode is seen', () => {
    const p = computeProgress(seasons, [...s1, ...[1, 2, 3, 4, 5].map((e) => w(2, e))], {
      lastAired,
    });
    expect(p.status).toBe('up_to_date');
    expect(p.behind).toBe(0);
    expect(p.nextUp).toBeNull();
    expect(p.complete).toBe(false);
  });

  it('stays up to date while the provider says the series is running', () => {
    const all = [...s1, ...Array.from({ length: 8 }, (_, i) => w(2, i + 1))];
    expect(computeProgress(seasons, all, { ongoing: true }).status).toBe('up_to_date');
    expect(computeProgress(seasons, all, { ongoing: false }).status).toBe('watched');
  });

  it('ignores a last aired episode that sits in specials', () => {
    const p = computeProgress(seasons, [], {
      lastAired: { seasonNumber: 0, episodeNumber: 2, airDate: '2026-09-18' },
    });
    expect(p.aired).toBe(18);
  });
});

describe('computeProgress with logs', () => {
  const lastAired = { seasonNumber: 2, episodeNumber: 5, airDate: '2026-09-18' };

  it('treats a season log as every aired episode of that season', () => {
    const p = computeProgress(seasons, [], {
      lastAired,
      logs: [{ season: 2, watchedOn: '2026-09-19' }],
    });
    expect(p.perSeason[1]).toMatchObject({ watched: 5, watchedAired: 5, aired: 5 });
    expect(p.perSeason[0]).toMatchObject({ watched: 0 });
    expect(p.status).toBe('behind');
    expect(p.behind).toBe(10);
    // Season 1 is unwatched but the pointer keeps moving forward from the latest watched episode.
    expect(p.nextUp).toBeNull();
    expect(p.lastWatched).toEqual({ seasonNumber: 2, episodeNumber: 5 });
  });

  it('treats a whole-series log after the last aired episode as up to date', () => {
    const p = computeProgress(seasons, [], {
      lastAired,
      logs: [{ season: null, watchedOn: '2026-09-18' }],
    });
    expect(p).toMatchObject({ watchedAired: 15, behind: 0, status: 'up_to_date', exact: true });
  });

  it('treats a whole-series log before the running season as behind on that season', () => {
    const p = computeProgress(seasons, [], {
      lastAired,
      logs: [{ season: null, watchedOn: '2023-06-01' }],
    });
    expect(p).toMatchObject({ watchedAired: 10, behind: 5, status: 'behind', exact: true });
    expect(p.nextUp).toEqual({ seasonNumber: 2, episodeNumber: 1 });
  });

  it('places a whole-series log inside the running season when episode air dates are given', () => {
    const logs = [{ season: null, watchedOn: '2026-09-05' }];
    const airing = seasons.map((s) => (s.seasonNumber === 2 ? { ...s, airDate: '2026-08-21' } : s));
    const vague = computeProgress(airing, [], { lastAired, logs });
    expect(vague.exact).toBe(false);
    expect(vague.behind).toBe(5);
    expect(needsCurrentSeasonEpisodes(airing, logs, lastAired)).toBe(true);

    const episodes = ['2026-08-28', '2026-09-04', '2026-09-11', '2026-09-18', '2026-09-25'].map(
      (airDate, i) => ({ episodeNumber: i + 1, airDate }),
    );
    const precise = computeProgress(airing, [], {
      lastAired,
      logs,
      currentSeasonEpisodes: episodes,
    });
    expect(precise.exact).toBe(true);
    expect(precise.perSeason[1]).toMatchObject({ watchedAired: 2, aired: 5 });
    expect(precise.behind).toBe(3);
    expect(precise.nextUp).toEqual({ seasonNumber: 2, episodeNumber: 3 });
    expect(
      needsCurrentSeasonEpisodes(seasons, [{ season: null, watchedOn: '2026-09-19' }], lastAired),
    ).toBe(false);
  });

  it('merges ticks and logs without double counting', () => {
    const p = computeProgress(seasons, [w(1, 1), w(1, 2)], {
      lastAired,
      logs: [{ season: 1, watchedOn: '2025-01-01' }],
    });
    expect(p.perSeason[0]).toMatchObject({ watched: 10 });
    expect(p.watched).toBe(10);
  });

  it('is unwatched only when there is neither a tick nor a log', () => {
    expect(computeProgress(seasons, [], { lastAired }).status).toBe('unwatched');
    expect(
      computeProgress(seasons, [], { lastAired, logs: [{ season: null, watchedOn: '2026-09-19' }] })
        .status,
    ).toBe('up_to_date');
  });
});
