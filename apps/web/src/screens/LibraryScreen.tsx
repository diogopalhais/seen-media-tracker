import { FilmStrip, MagnifyingGlass, SlidersHorizontal } from '@phosphor-icons/react';
import { formatPlaytime, type LibraryItemSummary } from '@seen/shared';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  DEFAULT_FILTERS,
  FilterSheet,
  isDefaultFilters,
  type LibraryFilters,
} from '../components/FilterSheet.js';
import { MediaTypeChips } from '../components/MediaTypeChips.js';
import { episodesLeft, ReleaseBadge, ReleasesShelf } from '../components/ReleasesShelf.js';
import { Banner } from '../components/ui/Banner.js';
import { Button, Spinner } from '../components/ui/Button.js';
import { EmptyState, MediaTypeGlyph, Poster } from '../components/ui/Media.js';
import { MediaCardText } from '../components/ui/MediaCardText.js';
import { IconCircleButton, Screen } from '../components/ui/NavBar.js';
import { ShelfHeader } from '../components/ui/PosterRow.js';
import { PosterGridSkeleton } from '../components/ui/Skeleton.js';
import { ApiError } from '../lib/api.js';
import { libraryTitle, MEDIA_KINDS } from '../lib/mediaKinds.js';
import { useGamesEnabled, useLibraryQuery, useLibraryReleasesQuery } from '../lib/queries.js';

/**
 * Grid meta for a series: "3 left" (aired, unwatched), "Up to date", "Watched", or the ticked
 * episode count when the standing is unknown. Muted series say so instead of a count.
 */
export function seriesStanding(item: LibraryItemSummary): string | null {
  if (item.mediaType === 'game')
    return item.minutesPlayed > 0 ? `${formatPlaytime(item.minutesPlayed)} played` : null;
  if (item.mediaType !== 'tv') return null;
  if (item.muted) return 'Not following';
  const p = item.progress;
  if (!p) return item.episodesWatched > 0 ? `${item.episodesWatched} eps` : null;
  if (p.status === 'behind') return p.exact ? `${p.behind} left` : 'New episodes';
  if (p.status === 'up_to_date') return 'Up to date';
  if (p.status === 'watched') return 'Watched';
  return null;
}

const GRID_SUBTITLE: Record<LibraryFilters['sort'], string> = {
  recent: 'Most recent first',
  title: 'A to Z',
  rating: 'Your highest rated first',
};

// Persisted for as long as the app stays open, across navigation into and out of items.
let savedFilters: LibraryFilters = DEFAULT_FILTERS;

export function LibraryScreen() {
  const [filters, setFilters] = useState<LibraryFilters>(savedFilters);
  const [filterOpen, setFilterOpen] = useState(false);
  const navigate = useNavigate();
  const query = useLibraryQuery(filters);
  const releases = useLibraryReleasesQuery();
  const games = useGamesEnabled();
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    savedFilters = filters;
  }, [filters]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !query.hasNextPage || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !query.isFetchingNextPage)
          void query.fetchNextPage();
      },
      { root: el.closest('[data-pane]'), rootMargin: '400px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [query.hasNextPage, query.isFetchingNextPage, query.fetchNextPage, query]);

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const errorMessage =
    query.error instanceof ApiError
      ? query.error.message
      : query.error
        ? 'Could not load your library.'
        : null;
  const active = !isDefaultFilters(filters);

  return (
    <Screen
      title="Library"
      large
      trailing={
        <IconCircleButton
          aria-label={filters.sort !== DEFAULT_FILTERS.sort ? 'Sort (active)' : 'Sort'}
          aria-haspopup="dialog"
          onClick={() => setFilterOpen(true)}
          className="relative"
        >
          <SlidersHorizontal weight="bold" className="size-5" aria-hidden="true" />
          {filters.sort !== DEFAULT_FILTERS.sort && (
            <span
              aria-hidden="true"
              className="absolute right-1 top-1 size-2 rounded-full bg-tint ring-2 ring-bg-grouped"
            />
          )}
        </IconCircleButton>
      }
    >
      <MediaTypeChips
        value={filters.type}
        onChange={(type) => setFilters((f) => ({ ...f, type }))}
        features={{ games }}
        className="mb-3"
      />

      {errorMessage && items.length > 0 && (
        <Banner tone="error" onRetry={() => void query.refetch()}>
          {errorMessage}
        </Banner>
      )}

      {/* Episode shelves belong to series: shown for All and for the TV filter. */}
      {(filters.type === 'all' || filters.type === 'tv') && releases.data && (
        <ReleasesShelf items={releases.data.items} />
      )}

      {items.length > 0 && (
        <ShelfHeader title={libraryTitle(filters.type)} subtitle={GRID_SUBTITLE[filters.sort]} />
      )}
      <div className="safe-x pt-1">
        {query.isPending ? (
          <PosterGridSkeleton />
        ) : errorMessage && items.length === 0 ? (
          <EmptyState
            icon={<FilmStrip />}
            title="Couldn't load your library"
            message={errorMessage}
            action={
              <Button variant="tinted" onClick={() => void query.refetch()}>
                Retry
              </Button>
            }
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<FilmStrip />}
            title={
              filters.type === 'all' ? 'Nothing seen yet' : MEDIA_KINDS[filters.type].emptyTitle
            }
            message={
              filters.type !== 'all'
                ? `Nothing of this kind yet. Pick another chip above, or search for a ${MEDIA_KINDS[filters.type].label.toLowerCase()} to log.`
                : 'Find a movie, series or game and log your first watch.'
            }
            action={
              active ? (
                <Button variant="tinted" onClick={() => setFilters(DEFAULT_FILTERS)}>
                  Reset filters
                </Button>
              ) : (
                <Button
                  variant="filled"
                  onClick={() => navigate('/search')}
                  icon={<MagnifyingGlass weight="bold" className="size-4" aria-hidden="true" />}
                >
                  Search
                </Button>
              )
            }
          />
        ) : (
          <ul className="poster-grid reveal m-0 list-none p-0">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  to={`/library/${item.id}`}
                  className="pressable poster-hover flex flex-col gap-2 rounded-card no-underline focus-visible:outline-offset-4"
                >
                  <div className="relative">
                    <Poster
                      src={item.posterUrl}
                      alt={item.title}
                      className="shadow-[var(--shadow-poster)]"
                    />
                    {item.release?.kind === 'new_episode' && (
                      <ReleaseBadge kind="new_episode" left={episodesLeft(item)} />
                    )}
                    {filters.type === 'all' && <MediaTypeGlyph mediaType={item.mediaType} />}
                  </div>
                  <MediaCardText
                    title={item.title}
                    meta={[
                      item.releaseYear ?? null,
                      item.watchCount > 1 ? `${item.watchCount}×` : null,
                      seriesStanding(item),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    tmdbRating={item.tmdbRating}
                    ownerRating={item.rating}
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div ref={sentinelRef} className="flex h-12 items-center justify-center">
          {query.isFetchingNextPage && <Spinner className="text-label-secondary" />}
        </div>
      </div>

      <FilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        filters={filters}
        onChange={setFilters}
      />
    </Screen>
  );
}
