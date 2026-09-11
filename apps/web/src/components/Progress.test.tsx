import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { ContinueWatchingCard, SeasonProgressHeader } from './Progress.js';

const seasons = [
  { seasonNumber: 1, name: 'Season 1', episodeCount: 10, airDate: '2022-01-01', isSpecials: false },
  { seasonNumber: 2, name: 'Season 2', episodeCount: 8, airDate: '2024-01-01', isSpecials: false },
];
const w = (s: number, e: number) => ({
  seasonNumber: s,
  episodeNumber: e,
  watchedOn: '2026-09-01',
});

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
});

describe('ContinueWatchingCard', () => {
  it('is hidden until an episode is watched', () => {
    const { container } = wrap(
      <ContinueWatchingCard tmdbId={1} seasons={seasons} watches={[]} basePath="/library/x" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('points at the next episode with overall progress', () => {
    wrap(
      <ContinueWatchingCard
        tmdbId={1}
        seasons={seasons}
        watches={[1, 2, 3, 4, 5].map((e) => w(1, e))}
        basePath="/library/x"
      />,
    );
    expect(screen.getByText('Next up')).toBeInTheDocument();
    expect(screen.getByText('S1 E6')).toBeInTheDocument();
    expect(screen.getByText('5 of 18 episodes')).toBeInTheDocument();
  });

  it('says all caught up when complete', () => {
    const all = [
      ...Array.from({ length: 10 }, (_, i) => w(1, i + 1)),
      ...Array.from({ length: 8 }, (_, i) => w(2, i + 1)),
    ];
    wrap(<ContinueWatchingCard tmdbId={1} seasons={seasons} watches={all} basePath="/library/x" />);
    expect(screen.getByText('All caught up')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '18');
  });
});
