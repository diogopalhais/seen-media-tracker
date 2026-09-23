import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TitleDetailsList } from './TitleDetailsList.js';

const hbo = { tmdbId: 49, name: 'HBO', logoUrl: null };
const creator = (name: string, id: number) => ({
  tmdbId: id,
  name,
  role: 'Creator',
  profileUrl: null,
  tmdbUrl: `https://www.themoviedb.org/person/${id}`,
});

describe('TitleDetailsList', () => {
  it('shows a returning series with its next episode, network and creators', () => {
    const { container } = render(
      <TitleDetailsList
        mediaType="tv"
        status="Returning Series"
        nextEpisodeToAir={{
          seasonNumber: 3,
          episodeNumber: 1,
          name: 'Pilot',
          airDate: '2026-09-18',
        }}
        lastEpisodeToAir={{ seasonNumber: 2, episodeNumber: 9, name: 'Old', airDate: '2026-09-05' }}
        networks={[hbo]}
        crew={[creator('Ann', 1), creator('Bob', 2)]}
        today="2026-09-10"
      />,
    );
    // The relative date is locale-formatted ("in 8 days", "dentro de 8 dias", …).
    const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(8, 'day');
    expect(container).toHaveTextContent(`Returning · Next · S3 E1 · Pilot · ${relative}`);
    expect(screen.getByText('Network')).toBeInTheDocument();
    expect(screen.getByText('HBO')).toBeInTheDocument();
    expect(screen.getByText('Creators')).toBeInTheDocument();
    expect(screen.getByText('Ann, Bob')).toBeInTheDocument();
  });

  it('falls back to the latest aired episode for an ended series', () => {
    const { container } = render(
      <TitleDetailsList
        mediaType="tv"
        status="Ended"
        nextEpisodeToAir={null}
        lastEpisodeToAir={{ seasonNumber: 4, episodeNumber: 8, name: '', airDate: '2026-09-07' }}
        today="2026-09-10"
      />,
    );
    const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(-3, 'day');
    expect(container).toHaveTextContent(`Ended · Latest · S4 E8 · ${relative}`);
  });

  it('omits the status of a released movie and renders nothing without data', () => {
    const { container } = render(
      <TitleDetailsList mediaType="movie" status="Released" crew={[]} productionCompanies={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
    render(
      <TitleDetailsList
        mediaType="movie"
        status="Released"
        crew={[
          {
            tmdbId: 9,
            name: 'Denis',
            role: 'Director, Screenplay',
            profileUrl: null,
            tmdbUrl: 'https://www.themoviedb.org/person/9',
          },
        ]}
        productionCompanies={[{ tmdbId: 1, name: 'Legendary', logoUrl: null }]}
      />,
    );
    expect(screen.queryByText('Status')).toBeNull();
    expect(screen.getByText('Director, Screenplay')).toBeInTheDocument();
    expect(screen.getByText('Legendary')).toBeInTheDocument();
  });

  it('lists release date, platforms, developer and publisher for a game', () => {
    render(
      <TitleDetailsList
        mediaType="game"
        status="Released"
        releaseDate="2020-09-17"
        platforms={[
          { tmdbId: 6, name: 'PC', logoUrl: null },
          { tmdbId: 130, name: 'Switch', logoUrl: null },
        ]}
        developers={[{ tmdbId: 1, name: 'Supergiant Games', logoUrl: null }]}
        publishers={[
          { tmdbId: 1, name: 'Supergiant Games', logoUrl: null },
          { tmdbId: 2, name: 'Private Division', logoUrl: null },
        ]}
        today="2026-09-23"
      />,
    );
    expect(screen.getByText('Released')).toBeInTheDocument();
    expect(screen.getByText(/2020/)).toBeInTheDocument();
    expect(screen.getByText('Platforms')).toBeInTheDocument();
    expect(screen.getByText('PC, Switch')).toBeInTheDocument();
    expect(screen.getByText('Developer')).toBeInTheDocument();
    expect(screen.getByText('Publishers')).toBeInTheDocument();
    expect(screen.getByText('Supergiant Games, Private Division')).toBeInTheDocument();
  });

  it('labels an early access game with its status', () => {
    render(<TitleDetailsList mediaType="game" status="Early Access" releaseDate="2026-03-01" />);
    expect(screen.getByText(/^Early Access · /)).toBeInTheDocument();
  });
});
