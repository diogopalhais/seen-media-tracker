import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
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
    expect(screen.getByRole('button', { name: 'Mark as Watched' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log with details' })).toBeInTheDocument();
    expect(screen.queryByText('Watched')).toBeNull();
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
        }}
      />,
    );
    expect(screen.getByText('Watched')).toBeInTheDocument();
    // Date formatting follows the machine locale; assert the year is shown.
    expect(screen.getByText(/2026/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rate' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log another watch' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark as Watched' })).toBeNull();
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
        }}
      />,
    );
    expect(screen.getByText(/2 times/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Your rating 7 out of 10/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rate' })).toBeNull();
  });
});
