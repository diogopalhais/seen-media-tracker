import { SmileyMeh } from '@phosphor-icons/react';
import type { MediaType, MediaTypeFilter, SearchResult } from '@seen/shared';
import { useEffect, useState } from 'react';
import { MediaTypeChips } from '../components/MediaTypeChips.js';
import { Button } from '../components/ui/Button.js';
import { EmptyState } from '../components/ui/Media.js';
import { Screen } from '../components/ui/NavBar.js';
import { PosterRow } from '../components/ui/PosterRow.js';
import { ApiError } from '../lib/api.js';
import { MEDIA_KINDS } from '../lib/mediaKinds.js';
import { useDiscoverQuery, useGamesEnabled } from '../lib/queries.js';

// Persisted while the app stays open, like the library filter.
let savedFilter: MediaTypeFilter = 'all';

interface Row {
  key: string;
  title: string;
  subtitle: string;
  /** Filters this row appears under. The mixed trending row stands in for its per-kind splits under All. */
  showUnder: readonly MediaTypeFilter[];
  /** True for game rows, which need IGDB. */
  needsGames?: boolean;
  items: SearchResult[] | undefined;
  /** Rows spanning several kinds mark each poster with its kind glyph. */
  mixed?: boolean;
  /** Hidden when empty after loading (optional upstreams such as IGDB). */
  optional?: boolean;
}

const onlyKind = (items: SearchResult[] | undefined, kind: MediaType) =>
  items?.filter((r) => r.mediaType === kind);

/**
 * Browse what is trending and popular, organised by media kind exactly like the library: the same
 * chips on top, the same glyph on posters in mixed rows. Every card opens inside this tab's stack.
 */
export function DiscoverScreen() {
  const discover = useDiscoverQuery(true);
  const games = useGamesEnabled();
  const [filter, setFilter] = useState<MediaTypeFilter>(savedFilter);
  useEffect(() => {
    savedFilter = filter;
  }, [filter]);
  const effective = filter === 'game' && !games ? 'all' : filter;
  const d = discover.data;

  const rows: Row[] = [
    {
      key: 'trending',
      title: 'Trending this week',
      subtitle: 'What everyone is watching right now',
      showUnder: ['all'],
      items: d?.trending,
      mixed: true,
    },
    {
      key: 'trending-movie',
      title: 'Trending Movies',
      subtitle: 'Movies everyone is watching this week',
      showUnder: ['movie'],
      items: onlyKind(d?.trending, 'movie'),
    },
    {
      key: 'trending-tv',
      title: 'Trending TV Series',
      subtitle: 'Series everyone is watching this week',
      showUnder: ['tv'],
      items: onlyKind(d?.trending, 'tv'),
    },
    {
      key: 'popular-movie',
      title: 'Popular Movies',
      subtitle: 'Most popular movies this week',
      showUnder: ['all', 'movie'],
      items: d?.popularMovies,
    },
    {
      key: 'popular-tv',
      title: 'Popular TV Series',
      subtitle: 'Series people keep coming back to',
      showUnder: ['all', 'tv'],
      items: d?.popularTv,
    },
    {
      key: 'trending-game',
      title: 'Trending Games',
      subtitle: 'What people are playing right now',
      showUnder: ['all', 'game'],
      needsGames: true,
      items: d?.trendingGames,
      optional: true,
    },
    {
      key: 'top-game',
      title: 'Acclaimed Recent Games',
      subtitle: 'Best rated releases of the past year',
      showUnder: ['all', 'game'],
      needsGames: true,
      items: d?.topGames,
      optional: true,
    },
  ];

  const visible = rows.filter(
    (row) =>
      row.showUnder.includes(effective) &&
      (games || !row.needsGames) &&
      !(row.optional && d && (row.items?.length ?? 0) === 0),
  );

  return (
    <Screen title="Discover" large>
      <MediaTypeChips
        value={effective}
        onChange={setFilter}
        features={{ games }}
        className="mb-1"
      />
      {discover.isError ? (
        <EmptyState
          icon={<SmileyMeh />}
          title="Couldn't load Discover"
          message={
            discover.error instanceof ApiError ? discover.error.message : 'Please try again.'
          }
          action={
            <Button variant="tinted" onClick={() => void discover.refetch()}>
              Retry
            </Button>
          }
        />
      ) : visible.length === 0 && d ? (
        <EmptyState
          icon={<SmileyMeh />}
          title={`Nothing to browse for ${effective === 'all' ? 'now' : MEDIA_KINDS[effective].plural.toLowerCase()}`}
          message="The source for this kind is not answering right now. Try again in a moment."
        />
      ) : (
        <div className="pb-2">
          {visible.map((row) => (
            <PosterRow
              key={row.key}
              title={row.title}
              subtitle={row.subtitle}
              items={row.items}
              mixed={row.mixed ?? false}
              loading={discover.isPending}
              basePath="/discover"
            />
          ))}
        </div>
      )}
    </Screen>
  );
}
