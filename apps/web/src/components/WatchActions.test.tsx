import { computeProgress, type EpisodeWatch, type ProgressOptions } from '@seen/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { SeriesStanding } from '../lib/seriesProgress.js';
import { WatchActions } from './WatchActions.js';

const target = {
  mediaType: 'movie' as const,
  tmdbId: 550,
  title: 'Fight Club',
  releaseYear: 1999,
  seasons: null,
  numberOfSeasons: null,
};
const item = {
  id: 'i1',
  mediaType: 'movie' as const,
  tmdbId: 550,
  title: 'Fight Club',
  originalTitle: 'Fight Club',
  releaseYear: 1999,
  releaseDate: '1999-10-15',
  posterUrl: null,
  backdropUrl: null,
  overview: '',
  genres: [],
  runtimeMinutes: 139,
  numberOfSeasons: null,
  tmdbRating: { average: 8.4, count: 100 },
  tmdbUrl: 'https://www.themoviedb.org/movie/550',
  status: 'Released',
  lastEpisodeToAir: null,
  nextEpisodeToAir: null,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};
const entry = (id: string, watchedOn: string, rating: number | null) => ({
  id,
  mediaItemId: 'i1',
  watchedOn,
  rating,
  season: null,
  note: null,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
});

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('WatchActions', () => {
  it('leads with Mark as Watched when nothing is logged', () => {
    wrap(<WatchActions target={target} detail={undefined} />);
    expect(screen.getByRole('button', { name: 'Mark Watched' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log with details' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Watched/ })).toBeNull();
  });

  it('shows the watched status with date and a Rate action when unrated', () => {
    wrap(
      <WatchActions
        target={target}
        detail={{
          item,
          rating: null,
          watchCount: 1,
          entries: [entry('e1', '2026-09-11', null)],
          episodeWatches: [],
          muted: false,
        }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Watched. Log another watch' })).toBeInTheDocument();
    // Date formatting follows the machine locale; assert the year is shown.
    expect(screen.getByText(/2026/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rate' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log another' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark Watched' })).toBeNull();
  });

  it('shows the rating badge and the number of times when rated and rewatched', () => {
    wrap(
      <WatchActions
        target={target}
        detail={{
          item,
          rating: 7,
          watchCount: 2,
          entries: [entry('e2', '2026-09-11', 7), entry('e1', '2026-08-01', null)],
          episodeWatches: [],
          muted: false,
        }}
      />,
    );
    expect(screen.getByText(/2 times/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Your rating 7 out of 10/ })).toHaveTextContent(
      '7/10',
    );
    expect(screen.queryByRole('button', { name: 'Rate' })).toBeNull();
  });
});

describe('WatchActions for a series', () => {
  const seasons = [
    {
      seasonNumber: 1,
      name: 'Season 1',
      episodeCount: 10,
      airDate: '2022-01-01',
      isSpecials: false,
    },
    {
      seasonNumber: 2,
      name: 'Season 2',
      episodeCount: 8,
      airDate: '2026-08-21',
      isSpecials: false,
    },
  ];
  const tvTarget = { ...target, mediaType: 'tv' as const, tmdbId: 1399, title: 'Show', seasons };
  const tvItem = {
    ...item,
    mediaType: 'tv' as const,
    tmdbId: 1399,
    title: 'Show',
    status: 'Returning Series',
    lastEpisodeToAir: { seasonNumber: 2, episodeNumber: 5, name: 'Five', airDate: '2026-09-18' },
    nextEpisodeToAir: { seasonNumber: 2, episodeNumber: 6, name: 'Six', airDate: '2026-09-25' },
  };
  const lastAired = tvItem.lastEpisodeToAir;
  const w = (s: number, e: number): EpisodeWatch => ({
    seasonNumber: s,
    episodeNumber: e,
    watchedOn: '2026-09-01',
  });
  const s1 = Array.from({ length: 10 }, (_, i) => w(1, i + 1));

  function series(
    watches: EpisodeWatch[],
    entries: ReturnType<typeof entry>[],
    options: Omit<ProgressOptions, 'logs'> = { lastAired, ongoing: true },
  ) {
    const standing: SeriesStanding = {
      progress: computeProgress(seasons, watches, { ...options, logs: entries }),
      nextToAir: tvItem.nextEpisodeToAir,
      loading: false,
    };
    const detail = {
      item: tvItem,
      rating: entries[0]?.rating ?? null,
      watchCount: entries.length,
      entries,
      episodeWatches: watches,
      muted: false,
    };
    return { standing, detail };
  }

  it('says Continue with the next aired episode and how far behind when episodes are left', () => {
    const { standing, detail } = series([...s1, w(2, 1), w(2, 2)], []);
    wrap(
      <WatchActions
        target={tvTarget}
        detail={detail}
        series={{ standing, basePath: '/library/i1' }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Behind. Continue with S2 E3' })).toHaveTextContent(
      'Continue S2 E3',
    );
    expect(screen.getByTestId('watch-standing')).toHaveTextContent(
      '3 episodes behind · 12 of 15 aired',
    );
    // Only episodes were ticked: offer to log rather than to rate a log that does not exist.
    expect(screen.getByRole('button', { name: 'Log with details' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rate' })).toBeNull();
  });

  it('does not say Watched because of a whole-series log when new episodes have aired since', () => {
    const { standing, detail } = series([], [entry('e1', '2023-05-01', 8)]);
    wrap(
      <WatchActions
        target={tvTarget}
        detail={detail}
        series={{ standing, basePath: '/library/i1' }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Behind. Continue with S2 E1' })).toBeInTheDocument();
    expect(screen.getByTestId('watch-standing')).toHaveTextContent(
      '5 episodes behind · 10 of 15 aired',
    );
    expect(screen.getByRole('button', { name: /Your rating 8 out of 10/ })).toBeInTheDocument();
  });

  it('is up to date, not watched, when every aired episode is seen on a running series', () => {
    const { standing, detail } = series([...s1, ...[1, 2, 3, 4, 5].map((e) => w(2, e))], []);
    wrap(
      <WatchActions
        target={tvTarget}
        detail={detail}
        series={{ standing, basePath: '/library/i1' }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Up to date. Log a watch' })).toBeInTheDocument();
    expect(screen.getByTestId('watch-standing')).toHaveTextContent(
      /^S2 E6 airs .* · 15 of 18 episodes aired/,
    );
    expect(screen.queryByRole('button', { name: /^Watched/ })).toBeNull();
  });

  it('says Watched once the series has ended and every episode is seen', () => {
    const all = [...s1, ...Array.from({ length: 8 }, (_, i) => w(2, i + 1))];
    const { standing, detail } = series(all, [entry('e1', '2026-09-11', null)], { ongoing: false });
    wrap(
      <WatchActions
        target={tvTarget}
        detail={detail}
        series={{ standing, basePath: '/library/i1' }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Watched. Log another watch' })).toBeInTheDocument();
    expect(screen.getByTestId('watch-standing')).toHaveTextContent(/^Watched .*2026 · 18 episodes/);
  });

  it('still offers Mark Watched when nothing is ticked or logged', () => {
    const { standing } = series([], []);
    wrap(
      <WatchActions
        target={tvTarget}
        detail={undefined}
        series={{ standing, basePath: '/library/i1' }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Mark Watched' })).toBeInTheDocument();
  });
});
