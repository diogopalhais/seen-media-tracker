import { CaretDown, FilmStrip, MagnifyingGlass } from '@phosphor-icons/react';
import type { LibrarySort, MediaTypeFilter } from '@seen/shared';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Banner } from '../components/ui/Banner.js';
import { Button, Spinner } from '../components/ui/Button.js';
import { EmptyState, Poster, RatingBadge } from '../components/ui/Media.js';
import { Screen } from '../components/ui/NavBar.js';
import { SegmentedControl } from '../components/ui/SegmentedControl.js';
import { PosterGridSkeleton } from '../components/ui/Skeleton.js';
import { ApiError } from '../lib/api.js';
import { useLibraryQuery } from '../lib/queries.js';

// Persisted for as long as the app stays open, across navigation into and out of items.
let savedFilters: { type: MediaTypeFilter; sort: LibrarySort } = { type: 'all', sort: 'recent' };

const SORT_LABEL: Record<LibrarySort, string> = {
  recent: 'Recent',
  title: 'Title',
  rating: 'Rating',
};

export function LibraryScreen() {
  const [filters, setFilters] = useState(savedFilters);
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

  return (
    <Screen
      title="Library"
      large
      accessory={
        <div className="flex items-center gap-1">
          <SegmentedControl<MediaTypeFilter>
            ariaLabel="Filter by type"
            value={filters.type}
            onChange={(type) => setFilters((f) => ({ ...f, type }))}
            segments={[
              { value: 'all', label: 'All' },
              { value: 'movie', label: 'Movies' },
              { value: 'tv', label: 'TV' },
            ]}
            className="flex-1"
          />
          <label className="relative shrink-0">
            <span className="visually-hidden">Sort by</span>
            <select
              value={filters.sort}
              onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value as LibrarySort }))}
              className="hit-target h-9 appearance-none rounded-full bg-fill pl-3 pr-8 text-[0.875rem] font-semibold text-label focus:outline-none focus:ring-2 focus:ring-tint/40"
            >
              {(Object.keys(SORT_LABEL) as LibrarySort[]).map((s) => (
                <option key={s} value={s}>
                  {SORT_LABEL[s]}
                </option>
              ))}
            </select>
            <CaretDown
              weight="bold"
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 size-3 -translate-y-1/2 text-label-secondary"
            />
          </label>
        </div>
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
            message="Find a movie or series and log your first watch."
            action={
              <Button
                variant="filled"
                onClick={() => navigate('/search')}
                icon={<MagnifyingGlass weight="bold" className="size-4" aria-hidden="true" />}
              >
                Search
              </Button>
            }
          />
        ) : (
          <ul className="poster-grid m-0 list-none p-0">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  to={`/library/${item.id}`}
                  className="pressable flex flex-col gap-1.5 rounded-card no-underline focus-visible:outline-offset-4"
                >
                  <div className="relative">
                    <Poster
                      src={item.posterUrl}
                      alt={item.title}
                      className="shadow-[var(--shadow-poster)]"
                    />
                    <RatingBadge
                      rating={item.rating}
                      tone="glass"
                      className="absolute left-2 top-2"
                    />
                  </div>
                  <span className="line-clamp-2 text-subheadline font-semibold leading-snug text-label">
                    {item.title}
                  </span>
                  <span className="-mt-1 text-footnote text-label-secondary">
                    {item.releaseYear ?? ''}
                    {item.watchCount > 1 ? ` · ${item.watchCount}×` : ''}
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
    </Screen>
  );
}
