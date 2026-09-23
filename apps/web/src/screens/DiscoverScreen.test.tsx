import type { SearchResult } from '@seen/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

const result = (mediaType: SearchResult['mediaType'], id: number, title: string): SearchResult => ({
  tmdbId: id,
  mediaType,
  title,
  originalTitle: title,
  releaseYear: 2024,
  posterUrl: null,
  overview: '',
  popularity: 1,
  tmdbRating: { average: null, count: 0 },
  inLibrary: false,
  libraryItemId: null,
});

const data = {
  trending: [result('tv', 1, 'Severance'), result('movie', 2, 'Dune')],
  popularMovies: [result('movie', 3, 'Heat')],
  popularTv: [result('tv', 4, 'The Wire')],
  trendingGames: [result('game', 5, 'Hades')],
  topGames: [],
};
const state = { games: true };

vi.mock('../lib/queries.js', () => ({
  useDiscoverQuery: () => ({
    data,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useGamesEnabled: () => state.games,
}));

import { DiscoverScreen } from './DiscoverScreen.js';

const rowTitles = () => screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'));

describe('DiscoverScreen', () => {
  it('uses the same kind chips as the library and marks mixed posters with a glyph', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DiscoverScreen />
      </MemoryRouter>,
    );
    expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual([
      'All',
      'Movies',
      'TV',
      'Games',
    ]);
    // Under All: mixed trending, both popular rows, trending games; the empty acclaimed row is dropped.
    expect(rowTitles()).toEqual([
      'Trending this week',
      'Popular Movies',
      'Popular TV Series',
      'Trending Games',
    ]);
    expect(screen.getByRole('img', { name: 'Series' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Movie' })).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'TV' }));
    expect(rowTitles()).toEqual(['Trending TV Series', 'Popular TV Series']);
    // The poster fallback repeats the title, so count rather than expect a single match.
    expect(screen.getAllByText('Severance').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Dune')).toHaveLength(0);

    await user.click(screen.getByRole('radio', { name: 'Games' }));
    expect(rowTitles()).toEqual(['Trending Games']);
  });

  it('hides everything game related when games are off', async () => {
    state.games = false;
    render(
      <MemoryRouter>
        <DiscoverScreen />
      </MemoryRouter>,
    );
    // The chosen kind persists across visits; start this test from All.
    await userEvent.setup().click(screen.getByRole('radio', { name: 'All' }));
    expect(screen.queryByRole('radio', { name: 'Games' })).toBeNull();
    expect(rowTitles()).toEqual(['Trending this week', 'Popular Movies', 'Popular TV Series']);
    state.games = true;
  });
});
