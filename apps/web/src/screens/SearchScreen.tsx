import { CheckCircle, SmileyMeh } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Banner } from '../components/ui/Banner.js';
import { Button } from '../components/ui/Button.js';
import { AudienceRating, EmptyState, MediaTypeBadge, Poster } from '../components/ui/Media.js';
import { Screen } from '../components/ui/NavBar.js';
import { PosterRow } from '../components/ui/PosterRow.js';
import { SearchField } from '../components/ui/SearchField.js';
import { ListSkeleton } from '../components/ui/Skeleton.js';
import { ApiError } from '../lib/api.js';
import { useDiscoverQuery, useSearchQuery } from '../lib/queries.js';

const DEBOUNCE_MS = 400;

// Keep the last query while the app is open so returning to the tab restores the results.
let savedQuery = '';

export function SearchScreen() {
  const [text, setText] = useState(savedQuery);
  const [debounced, setDebounced] = useState(savedQuery);
  const query = useSearchQuery(debounced, 'all');
  const active = debounced.trim().length > 0;
  const discover = useDiscoverQuery(!active);

  useEffect(() => {
    savedQuery = text;
    if (text.trim() === '') {
      setDebounced('');
      return;
    }
    const t = setTimeout(() => setDebounced(text), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [text]);

  const results = query.data?.results ?? [];
  const errorMessage =
    query.error instanceof ApiError ? query.error.message : query.error ? 'Search failed.' : null;

  return (
    <Screen
      title="Search"
      large
      accessory={
        <SearchField
          value={text}
          onChange={setText}
          placeholder="Movies and TV series"
          aria-label="Search movies and TV series"
          autoFocus={false}
        />
      }
    >
      {!active ? (
        discover.isError ? (
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
        ) : (
          <div className="pb-2">
            <PosterRow
              title="Trending this week"
              items={discover.data?.trending}
              mixed
              loading={discover.isPending}
            />
            <PosterRow
              title="Popular Movies"
              items={discover.data?.popularMovies}
              loading={discover.isPending}
            />
            <PosterRow
              title="Popular TV Series"
              items={discover.data?.popularTv}
              loading={discover.isPending}
            />
          </div>
        )
      ) : query.isPending ? (
        <ListSkeleton rows={6} />
      ) : errorMessage ? (
        <EmptyState
          icon={<SmileyMeh />}
          title="Search isn't available right now"
          message={errorMessage}
          action={
            <Button variant="tinted" onClick={() => void query.refetch()}>
              Retry
            </Button>
          }
        />
      ) : results.length === 0 ? (
        <EmptyState
          icon={<SmileyMeh />}
          title="No results"
          message={`Nothing matched “${debounced.trim()}”. Try another title.`}
        />
      ) : (
        <>
          {query.isFetching && query.data && (
            <Banner tone="info" className="my-0.5">
              Updating results…
            </Banner>
          )}
          <ul className="safe-x m-0 mt-1 list-none py-0" aria-label="Search results">
            {results.map((r) => (
              <li key={`${r.mediaType}-${r.tmdbId}`}>
                <Link
                  to={`/search/${r.mediaType}/${r.tmdbId}`}
                  className="pressable hairline-b flex items-center gap-1.5 py-1 no-underline"
                >
                  <Poster
                    src={r.posterUrl}
                    alt={r.title}
                    className="w-12 shrink-0 rounded-control"
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
                    <span className="truncate text-body text-label">{r.title}</span>
                    <span className="flex items-center gap-1 text-footnote text-label-secondary">
                      {r.releaseYear && <span>{r.releaseYear}</span>}
                      <MediaTypeBadge mediaType={r.mediaType} />
                      <AudienceRating rating={r.tmdbRating} showCount={false} />
                    </span>
                  </span>
                  {r.inLibrary && (
                    <span className="flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--success)_12%,transparent)] px-2 py-1 text-footnote font-semibold text-success">
                      <CheckCircle weight="fill" className="size-4" aria-hidden="true" />
                      Seen
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Screen>
  );
}
