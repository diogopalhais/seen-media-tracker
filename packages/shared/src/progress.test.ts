import { describe, expect, it } from 'vitest';
import { computeProgress, formatEpisode } from './progress.js';

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
    expect(p.perSeason[0]).toEqual({ seasonNumber: 1, watched: 6, total: 10 });
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
