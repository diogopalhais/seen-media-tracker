import { FilmStrip, MagnifyingGlass, SlidersHorizontal } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  DEFAULT_FILTERS,
  FilterSheet,
  isDefaultFilters,
  type LibraryFilters,
} from '../components/FilterSheet.js';
import { Banner } from '../components/ui/Banner.js';
import { Button, Spinner } from '../components/ui/Button.js';
import { AudienceRating, EmptyState, Poster, RatingBadge } from '../components/ui/Media.js';
import { IconCircleButton, Screen } from '../components/ui/NavBar.js';
import { PosterGridSkeleton } from '../components/ui/Skeleton.js';
import { ApiError } from '../lib/api.js';
import { useLibraryQuery } from '../lib/queries.js';

// Persisted for as long as the app stays open, across navigation into and out of items.
let savedFilters: LibraryFilters = DEFAULT_FILTERS;

export function LibraryScreen() {
  const [filters, setFilters] = useState<LibraryFilters>(savedFilters);
  const [filterOpen, setFilterOpen] = useState(false);
  const navigate = useNavigate();
  const query = useLibraryQuery(filters);
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
          aria-label={active ? 'Filter and sort (active)' : 'Filter and sort'}
          aria-haspopup="dialog"
          onClick={() => setFilterOpen(true)}
          className="relative"
        >
          <SlidersHorizontal weight="bold" className="size-5" aria-hidden="true" />
          {active && (
            <span
              aria-hidden="true"
              className="absolute right-1 top-1 size-2 rounded-full bg-tint ring-2 ring-bg-grouped"
            />
          )}
        </IconCircleButton>
      }
    >
      {errorMessage && items.length > 0 && (
        <Banner tone="error" onRetry={() => void query.refetch()}>
          {errorMessage}
        </Banner>
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
              filters.type === 'all'
                ? 'Nothing seen yet'
                : filters.type === 'movie'
                  ? 'No movies yet'
                  : 'No TV series yet'
            }
            message={
              active
                ? 'Nothing matches the current filter. Adjust it from the top-right button.'
                : 'Find a movie or series and log your first watch.'
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
                  className="pressable poster-hover flex flex-col gap-1.5 rounded-card no-underline focus-visible:outline-offset-4"
                >
                  <div className="relative">
                    <Poster
                      src={item.posterUrl}
                      alt={item.title}
                      className="shadow-[var(--shadow-poster)]"
                    />
                  </div>
                  <span className="line-clamp-2 text-subheadline font-semibold leading-snug text-label">
                    {item.title}
                  </span>
                  <span className="-mt-1 text-footnote text-label-secondary">
                    {item.releaseYear ?? ''}
                    {item.watchCount > 1 ? ` · ${item.watchCount}×` : ''}
                    {item.episodesWatched > 0 ? ` · ${item.episodesWatched} eps` : ''}
                  </span>
                  <span className="-mt-1 flex flex-wrap items-center gap-2">
                    <AudienceRating rating={item.tmdbRating} size="small" showCount={false} />
                    <RatingBadge rating={item.rating} />
                  </span>
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
