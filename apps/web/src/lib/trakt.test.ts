import { zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { classifyTraktRecord, parseTraktFiles, toLocalDate } from './trakt.js';

const movie = {
  title: 'Fight Club',
  year: 1999,
  ids: { trakt: 1, slug: 'fight-club-1999', imdb: 'tt0137523', tmdb: 550 },
};
const show = { title: 'Severance', year: 2022, ids: { trakt: 2, slug: 'severance', tmdb: 95396 } };

describe('classifyTraktRecord', () => {
  it('maps history plays for movies and episodes', () => {
    expect(
      classifyTraktRecord({
        id: 1,
        watched_at: '2026-01-02T20:00:00.000Z',
        action: 'watch',
        type: 'movie',
        movie,
      }),
    ).toEqual([
      {
        kind: 'record',
        record: {
          kind: 'movie_play',
          title: 'Fight Club',
          year: 1999,
          tmdbId: 550,
          watchedOn: toLocalDate('2026-01-02T20:00:00.000Z'),
        },
      },
    ]);
    const [ep] = classifyTraktRecord({
      watched_at: '2026-01-03T01:00:00.000Z',
      type: 'episode',
      episode: { season: 2, number: 5, title: 'Trojan', ids: { tmdb: 1 } },
      show,
    });
    expect(ep).toMatchObject({
      kind: 'record',
      record: {
        kind: 'episode_play',
        tmdbId: 95396,
        seasonNumber: 2,
        episodeNumber: 5,
        title: 'Severance',
      },
    });
  });

  it('maps ratings and marks episode ratings unsupported', () => {
    expect(
      classifyTraktRecord({
        rated_at: '2026-01-04T10:00:00.000Z',
        rating: 8,
        type: 'movie',
        movie,
      })[0],
    ).toMatchObject({ kind: 'record', record: { kind: 'movie_rating', rating: 8 } });
    expect(
      classifyTraktRecord({
        rated_at: '2026-01-04T10:00:00.000Z',
        rating: 9,
        type: 'show',
        show,
      })[0],
    ).toMatchObject({ kind: 'record', record: { kind: 'show_rating', rating: 9 } });
    expect(
      classifyTraktRecord({
        rated_at: '2026-01-04T10:00:00.000Z',
        rating: 10,
        type: 'season',
        season: { number: 1, ids: {} },
        show,
      })[0],
    ).toMatchObject({ kind: 'record', record: { kind: 'season_rating', seasonNumber: 1 } });
    expect(
      classifyTraktRecord({
        rated_at: '2026-01-04T10:00:00.000Z',
        rating: 7,
        type: 'episode',
        episode: { season: 1, number: 1, ids: {} },
        show,
      }),
    ).toEqual([{ kind: 'unsupported' }]);
  });

  it('expands watched summaries for shows and flags missing tmdb ids', () => {
    const out = classifyTraktRecord({
      plays: 3,
      last_watched_at: '2026-02-01T00:00:00.000Z',
      show,
      seasons: [
        {
          number: 1,
          episodes: [
            { number: 1, plays: 1, last_watched_at: '2026-01-10T00:00:00.000Z' },
            { number: 2, plays: 1, last_watched_at: '2026-01-11T00:00:00.000Z' },
          ],
        },
      ],
    });
    expect(out).toHaveLength(2);
    expect(
      classifyTraktRecord({
        watched_at: '2026-01-02T20:00:00.000Z',
        movie: { title: 'Obscure', ids: { trakt: 9 } },
      }),
    ).toEqual([{ kind: 'unmatched' }]);
    expect(classifyTraktRecord({ listed_at: '2026-01-02T20:00:00.000Z', movie })).toEqual([
      { kind: 'unsupported' },
    ]);
  });
});

describe('parseTraktFiles', () => {
  it('reads a zip export, dedupes and counts', async () => {
    const history = JSON.stringify([
      { watched_at: '2026-01-02T20:00:00.000Z', movie },
      { watched_at: '2026-01-02T22:00:00.000Z', movie }, // same local day → one record
      { watched_at: '2026-01-05T20:00:00.000Z', episode: { season: 1, number: 1 }, show },
    ]);
    const ratings = JSON.stringify([
      { rated_at: '2026-01-06T00:00:00.000Z', rating: 8, movie },
      { rated_at: '2026-01-06T00:00:00.000Z', rating: 6, episode: { season: 1, number: 1 }, show },
    ]);
    const zip = zipSync({
      'history.json': new TextEncoder().encode(history),
      'ratings.json': new TextEncoder().encode(ratings),
      'readme.txt': new TextEncoder().encode('hi'),
    });
    const file = new File([zip], 'trakt-export.zip');
    const summary = await parseTraktFiles([file]);
    expect(summary.files.sort()).toEqual(['history.json', 'ratings.json']);
    expect(summary.records.map((r) => r.kind).sort()).toEqual([
      'episode_play',
      'movie_play',
      'movie_rating',
    ]);
    expect(summary.unsupported).toBe(1);
  });

  it('rejects files without Trakt records', async () => {
    await expect(
      parseTraktFiles([new File([new TextEncoder().encode('{"hello":1}')], 'x.json')]),
    ).rejects.toThrow(/No Trakt records/);
    await expect(
      parseTraktFiles([new File([new TextEncoder().encode('not json')], 'x.json')]),
    ).rejects.toThrow(/not valid JSON/);
  });
});
