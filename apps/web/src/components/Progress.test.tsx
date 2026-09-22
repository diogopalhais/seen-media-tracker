import { computeProgress, type ProgressOptions } from '@seen/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { SeriesStanding } from '../lib/seriesProgress.js';
import { ContinueWatchingCard, SeasonProgressHeader, standingText } from './Progress.js';

const seasons = [
  { seasonNumber: 1, name: 'Season 1', episodeCount: 10, airDate: '2022-01-01', isSpecials: false },
  { seasonNumber: 2, name: 'Season 2', episodeCount: 8, airDate: '2026-08-21', isSpecials: false },
];
const w = (s: number, e: number) => ({
  seasonNumber: s,
  episodeNumber: e,
  watchedOn: '2026-09-01',
});
const s1 = Array.from({ length: 10 }, (_, i) => w(1, i + 1));
const lastAired = { seasonNumber: 2, episodeNumber: 5, name: 'Five', airDate: '2026-09-18' };
const nextToAir = { seasonNumber: 2, episodeNumber: 6, name: 'Six', airDate: '2026-09-25' };

function standing(
  watches: ReturnType<typeof w>[],
  options: ProgressOptions = {},
  extra: Partial<SeriesStanding> = {},
): SeriesStanding {
  return {
    progress: computeProgress(seasons, watches, options),
    nextToAir: null,
    loading: false,
    ...extra,
  };
}

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SeasonProgressHeader', () => {
  it('shows watched over total with an accessible progress bar', () => {
    render(<SeasonProgressHeader watched={3} total={10} />);
    expect(screen.getByText('3 of 10 watched')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3');
  });

  it('counts only aired episodes and mentions the rest', () => {
    render(<SeasonProgressHeader watched={5} total={5} unaired={3} />);
    expect(screen.getByText('5 of 5 aired watched · 3 not aired yet')).toBeInTheDocument();
  });
});

describe('ContinueWatchingCard', () => {
  it('is hidden until an episode is watched', () => {
    const { container } = wrap(
      <ContinueWatchingCard tmdbId={1} standing={standing([])} basePath="/library/x" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('points at the next episode with progress over aired episodes', () => {
    wrap(
      <ContinueWatchingCard
        tmdbId={1}
        standing={standing([1, 2, 3, 4, 5].map((e) => w(1, e)))}
        basePath="/library/x"
      />,
    );
    expect(screen.getByText('Next up')).toBeInTheDocument();
    expect(screen.getByText('S1 E6')).toBeInTheDocument();
    expect(screen.getByText('5 of 18 aired · 13 behind')).toBeInTheDocument();
  });

  it('never points past the last aired episode', () => {
    wrap(
      <ContinueWatchingCard
        tmdbId={1}
        standing={standing([...s1, w(2, 1), w(2, 2)], { lastAired })}
        basePath="/library/x"
      />,
    );
    expect(screen.getByText('S2 E3')).toBeInTheDocument();
    expect(screen.getByText('12 of 15 aired · 3 behind · 3 to come')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '15');
  });

  it('is up to date, with the next air date, once every aired episode is watched', () => {
    wrap(
      <ContinueWatchingCard
        tmdbId={1}
        standing={standing(
          [...s1, ...[1, 2, 3, 4, 5].map((e) => w(2, e))],
          { lastAired },
          { nextToAir },
        )}
        basePath="/library/x"
      />,
    );
    expect(screen.getByText('Up to date')).toBeInTheDocument();
    expect(screen.getByText(/^S2 E6 airs /)).toBeInTheDocument();
    expect(screen.getByText('15 of 15 aired · 3 to come')).toBeInTheDocument();
    expect(screen.getByTestId('continue-watching')).toHaveAttribute('data-status', 'up_to_date');
  });

  it('says all caught up when complete', () => {
    const all = [...s1, ...Array.from({ length: 8 }, (_, i) => w(2, i + 1))];
    wrap(<ContinueWatchingCard tmdbId={1} standing={standing(all)} basePath="/library/x" />);
    expect(screen.getByText('All caught up')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '18');
  });
});

describe('standingText', () => {
  it('describes each status in one line', () => {
    expect(standingText(standing([...s1, w(2, 1)], { lastAired }))).toBe(
      '4 episodes behind · 11 of 15 aired',
    );
    // The relative date follows the machine locale ("tomorrow", "amanhã", ...).
    expect(
      standingText(
        standing([...s1, ...[1, 2, 3, 4, 5].map((e) => w(2, e))], { lastAired }, { nextToAir }),
        '2026-09-24',
      ),
    ).toMatch(/^S2 E6 airs \S+ · 15 of 18 episodes aired$/);
    expect(
      standingText(standing([...s1, ...[1, 2, 3, 4, 5].map((e) => w(2, e))], { lastAired })),
    ).toBe('Waiting for the next episode · 15 of 18 episodes aired');
    expect(
      standingText(standing([...s1, ...Array.from({ length: 8 }, (_, i) => w(2, i + 1))])),
    ).toBe('All 18 episodes watched');
  });

  it('does not invent a number while the count is still uncertain', () => {
    const vague = standing([], { lastAired, logs: [{ season: null, watchedOn: '2026-09-05' }] });
    expect(vague.progress.exact).toBe(false);
    expect(standingText(vague)).toBe('New episodes since your last log');
    expect(standingText({ ...vague, loading: true })).toBe('Checking where you are…');
  });
});
