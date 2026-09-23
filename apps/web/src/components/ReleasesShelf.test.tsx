import type { LibraryItemSummary } from '@seen/shared';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { seriesStanding } from '../screens/LibraryScreen.js';
import { ReleasesShelf, releaseCopy } from './ReleasesShelf.js';

const TODAY = '2026-09-22';
const base: LibraryItemSummary = {
  id: 'i1',
  mediaType: 'tv',
  tmdbId: 1,
  title: 'Show',
  releaseYear: 2022,
  posterUrl: null,
  rating: null,
  tmdbRating: { average: null, count: 0 },
  lastWatchedOn: '2026-09-01',
  watchCount: 0,
  episodesWatched: 12,
  minutesPlayed: 0,
  lastSeason: null,
  release: null,
  progress: null,
  muted: false,
};
const aired = { seasonNumber: 2, episodeNumber: 9, name: 'Nine', airDate: '2026-09-19' };
const soon = { seasonNumber: 2, episodeNumber: 10, name: 'Ten', airDate: '2026-09-26' };
const behind = (n: number, next: number) => ({
  status: 'behind' as const,
  aired: 18,
  total: 19,
  behind: n,
  exact: true,
  nextUp: { seasonNumber: 2, episodeNumber: next },
});

describe('release shelves', () => {
  const shelf = (items: LibraryItemSummary[]) =>
    render(
      <MemoryRouter>
        <ReleasesShelf items={items} today={TODAY} />
      </MemoryRouter>,
    );
  const fresh = (progress: LibraryItemSummary['progress'] = null): LibraryItemSummary => ({
    ...base,
    release: { kind: 'new_episode', episode: aired },
    progress,
  });
  const upcoming = (progress: LibraryItemSummary['progress'] = null): LibraryItemSummary => ({
    ...base,
    id: 'i2',
    title: 'Other',
    release: { kind: 'upcoming', episode: soon },
    progress,
  });

  it('keep new episodes and upcoming ones in separate sections', () => {
    shelf([fresh(behind(3, 7)), upcoming()]);
    expect(screen.getByTestId('releases-new')).toHaveTextContent('Show');
    expect(screen.getByTestId('releases-new')).not.toHaveTextContent('Other');
    expect(screen.getByTestId('releases-soon')).toHaveTextContent('Other');
    expect(screen.getByRole('region', { name: 'New episodes' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Coming soon' })).toBeInTheDocument();
  });

  it('lead with how many episodes are left and which one is next, not the newest one', () => {
    shelf([fresh(behind(6, 3))]);
    expect(screen.getByText('6 to watch')).toBeInTheDocument();
    expect(screen.getByText('Next up S2 E3')).toBeInTheDocument();
    expect(screen.getByText(/^Latest S2 E9 · /)).toBeInTheDocument();
    expect(screen.queryByTestId('releases-soon')).toBeNull();
  });

  it('fall back to the newest episode when the count is unknown', () => {
    expect(releaseCopy(fresh(), TODAY)).toMatchObject({
      eyebrow: expect.stringMatching(/^Latest S2 E9 · /),
      headline: 'New episode',
      detail: 'Nine',
    });
  });

  it('lead with the air date when caught up, and with the backlog when not', () => {
    expect(releaseCopy(upcoming(), TODAY)).toMatchObject({
      eyebrow: 'S2 E10 · Ten',
      headline: expect.stringMatching(/^[A-Z]/),
      detail: "You're up to date",
    });
    expect(releaseCopy(upcoming(behind(2, 8)), TODAY)).toMatchObject({
      headline: '2 to watch',
      detail: expect.stringMatching(/^Airs .* · next S2 E8$/),
    });
  });

  it('are hidden when nothing is new', () => {
    const { container } = shelf([base]);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('seriesStanding in the grid', () => {
  it('reads the standing before the ticked count', () => {
    expect(seriesStanding(base)).toBe('12 eps');
    expect(seriesStanding({ ...base, progress: behind(3, 7) })).toBe('3 left');
    expect(
      seriesStanding({
        ...base,
        progress: { ...behind(0, 7), status: 'up_to_date', nextUp: null },
      }),
    ).toBe('Up to date');
    expect(
      seriesStanding({ ...base, progress: { ...behind(0, 7), status: 'watched', nextUp: null } }),
    ).toBe('Watched');
    expect(seriesStanding({ ...base, progress: { ...behind(5, 1), exact: false } })).toBe(
      'New episodes',
    );
    expect(seriesStanding({ ...base, muted: true, progress: behind(3, 7) })).toBe('Not following');
    expect(seriesStanding({ ...base, mediaType: 'movie' })).toBeNull();
  });
});
