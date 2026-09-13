import { type TraktImportRecord, todayLocalDateString } from '@seen/shared';
import { unzipSync } from 'fflate';

export interface TraktParseSummary {
  records: TraktImportRecord[];
  /** Records recognised as Trakt data but with no home in Seen (watchlist, collection, episode ratings…). */
  unsupported: number;
  /** Records that lacked a TMDB id and could not be mapped. */
  unmatched: number;
  files: string[];
}

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const tmdbIdOf = (v: unknown): number | null => {
  if (!isObj(v) || !isObj(v.ids)) return null;
  const id = v.ids.tmdb;
  return typeof id === 'number' && Number.isInteger(id) && id > 0 ? id : null;
};
const titleOf = (v: unknown): string =>
  isObj(v) && typeof v.title === 'string' ? v.title : 'Untitled';
const yearOf = (v: unknown): number | null =>
  isObj(v) && typeof v.year === 'number' ? v.year : null;
const int = (v: unknown): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null;

/** Trakt timestamps are UTC ISO strings; the library keeps calendar dates in the owner's timezone. */
export function toLocalDate(iso: unknown): string | null {
  if (typeof iso !== 'string') return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : todayLocalDateString(d);
}

type Classified =
  | { kind: 'record'; record: TraktImportRecord }
  | { kind: 'unsupported' }
  | { kind: 'unmatched' }
  | { kind: 'ignore' };

/** Recognises one Trakt object by shape (history play, rating, watched summary, list item). */
export function classifyTraktRecord(raw: unknown): Classified[] {
  if (!isObj(raw)) return [{ kind: 'ignore' }];
  const rating = int(raw.rating);

  // History plays: /sync/history and the export's history files.
  if (typeof raw.watched_at === 'string') {
    const on = toLocalDate(raw.watched_at);
    if (!on) return [{ kind: 'ignore' }];
    if (isObj(raw.movie)) {
      const tmdbId = tmdbIdOf(raw.movie);
      return tmdbId
        ? [
            {
              kind: 'record',
              record: {
                kind: 'movie_play',
                title: titleOf(raw.movie),
                year: yearOf(raw.movie),
                tmdbId,
                watchedOn: on,
              },
            },
          ]
        : [{ kind: 'unmatched' }];
    }
    if (isObj(raw.episode) && isObj(raw.show)) {
      const tmdbId = tmdbIdOf(raw.show);
      const seasonNumber = int(raw.episode.season);
      const episodeNumber = int(raw.episode.number);
      if (!tmdbId) return [{ kind: 'unmatched' }];
      if (seasonNumber === null || episodeNumber === null) return [{ kind: 'ignore' }];
      return [
        {
          kind: 'record',
          record: {
            kind: 'episode_play',
            title: titleOf(raw.show),
            year: yearOf(raw.show),
            tmdbId,
            seasonNumber,
            episodeNumber,
            watchedOn: on,
          },
        },
      ];
    }
    return [{ kind: 'unsupported' }];
  }

  // Ratings: /sync/ratings.
  if (typeof raw.rated_at === 'string' && rating !== null && rating >= 1 && rating <= 10) {
    const on = toLocalDate(raw.rated_at);
    if (!on) return [{ kind: 'ignore' }];
    if (isObj(raw.episode)) return [{ kind: 'unsupported' }];
    if (isObj(raw.movie)) {
      const tmdbId = tmdbIdOf(raw.movie);
      return tmdbId
        ? [
            {
              kind: 'record',
              record: {
                kind: 'movie_rating',
                title: titleOf(raw.movie),
                year: yearOf(raw.movie),
                tmdbId,
                rating,
                ratedOn: on,
              },
            },
          ]
        : [{ kind: 'unmatched' }];
    }
    if (isObj(raw.show)) {
      const tmdbId = tmdbIdOf(raw.show);
      if (!tmdbId) return [{ kind: 'unmatched' }];
      if (isObj(raw.season)) {
        const seasonNumber = int(raw.season.number);
        if (seasonNumber === null) return [{ kind: 'ignore' }];
        return [
          {
            kind: 'record',
            record: {
              kind: 'season_rating',
              title: titleOf(raw.show),
              year: yearOf(raw.show),
              tmdbId,
              seasonNumber,
              rating,
              ratedOn: on,
            },
          },
        ];
      }
      return [
        {
          kind: 'record',
          record: {
            kind: 'show_rating',
            title: titleOf(raw.show),
            year: yearOf(raw.show),
            tmdbId,
            rating,
            ratedOn: on,
          },
        },
      ];
    }
    return [{ kind: 'unsupported' }];
  }

  // Watched summaries: /sync/watched (movies: plays + last_watched_at; shows: seasons[].episodes[]).
  if (typeof raw.last_watched_at === 'string' && isObj(raw.movie)) {
    const on = toLocalDate(raw.last_watched_at);
    const tmdbId = tmdbIdOf(raw.movie);
    if (!on) return [{ kind: 'ignore' }];
    return tmdbId
      ? [
          {
            kind: 'record',
            record: {
              kind: 'movie_play',
              title: titleOf(raw.movie),
              year: yearOf(raw.movie),
              tmdbId,
              watchedOn: on,
            },
          },
        ]
      : [{ kind: 'unmatched' }];
  }
  if (isObj(raw.show) && Array.isArray(raw.seasons)) {
    const tmdbId = tmdbIdOf(raw.show);
    if (!tmdbId) return [{ kind: 'unmatched' }];
    const out: Classified[] = [];
    for (const season of raw.seasons) {
      if (!isObj(season) || !Array.isArray(season.episodes)) continue;
      const seasonNumber = int(season.number);
      if (seasonNumber === null) continue;
      for (const e of season.episodes) {
        if (!isObj(e)) continue;
        const episodeNumber = int(e.number);
        const on = toLocalDate(e.last_watched_at);
        if (episodeNumber === null || !on) continue;
        out.push({
          kind: 'record',
          record: {
            kind: 'episode_play',
            title: titleOf(raw.show),
            year: yearOf(raw.show),
            tmdbId,
            seasonNumber,
            episodeNumber,
            watchedOn: on,
          },
        });
      }
    }
    return out.length > 0 ? out : [{ kind: 'ignore' }];
  }

  // Watchlist, collection, comments, lists…
  if (
    typeof raw.listed_at === 'string' ||
    typeof raw.collected_at === 'string' ||
    isObj(raw.movie) ||
    isObj(raw.show)
  )
    return [{ kind: 'unsupported' }];
  return [{ kind: 'ignore' }];
}

/** Collects Trakt-looking objects from any JSON value (top-level arrays or arrays nested one level down). */
export function collectRawRecords(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (isObj(value)) {
    const out: unknown[] = [];
    for (const v of Object.values(value)) if (Array.isArray(v)) out.push(...v);
    return out;
  }
  return [];
}

const recordKey = (r: TraktImportRecord): string => {
  switch (r.kind) {
    case 'movie_play':
      return `mp:${r.tmdbId}:${r.watchedOn}`;
    case 'episode_play':
      return `ep:${r.tmdbId}:${r.seasonNumber}:${r.episodeNumber}:${r.watchedOn}`;
    case 'movie_rating':
      return `mr:${r.tmdbId}`;
    case 'show_rating':
      return `sr:${r.tmdbId}`;
    case 'season_rating':
      return `xr:${r.tmdbId}:${r.seasonNumber}`;
  }
};

const isZip = (bytes: Uint8Array) =>
  bytes.length > 3 &&
  bytes[0] === 0x50 &&
  bytes[1] === 0x4b &&
  (bytes[2] === 3 || bytes[2] === 5 || bytes[2] === 7);

/** Reads zip and JSON files from the Trakt export and normalises everything into import records. */
export async function parseTraktFiles(files: File[]): Promise<TraktParseSummary> {
  const summary: TraktParseSummary = { records: [], unsupported: 0, unmatched: 0, files: [] };
  const seen = new Set<string>();
  const decoder = new TextDecoder();
  const ingestJson = (name: string, text: string) => {
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      throw new Error(`${name} is not valid JSON`);
    }
    summary.files.push(name);
    for (const raw of collectRawRecords(value)) {
      for (const c of classifyTraktRecord(raw)) {
        if (c.kind === 'unsupported') summary.unsupported++;
        else if (c.kind === 'unmatched') summary.unmatched++;
        else if (c.kind === 'record') {
          const key = recordKey(c.record);
          if (!seen.has(key)) {
            seen.add(key);
            summary.records.push(c.record);
          }
        }
      }
    }
  };

  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (isZip(bytes) || file.name.toLowerCase().endsWith('.zip')) {
      const entries = unzipSync(bytes, {
        filter: (f) => f.name.toLowerCase().endsWith('.json') && !f.name.startsWith('__MACOSX'),
      });
      for (const [name, data] of Object.entries(entries)) ingestJson(name, decoder.decode(data));
    } else {
      ingestJson(file.name, decoder.decode(bytes));
    }
  }
  if (summary.files.length === 0) throw new Error('No JSON files found in the selected files');
  if (summary.records.length + summary.unsupported + summary.unmatched === 0)
    throw new Error('No Trakt records recognised in these files');
  return summary;
}
