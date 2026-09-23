import { CheckCircle, MagnifyingGlass, SmileyMeh } from '@phosphor-icons/react';
import type { MediaTypeFilter } from '@seen/shared';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { MediaTypeChips } from '../components/MediaTypeChips.js';
import { Banner } from '../components/ui/Banner.js';
import { Button } from '../components/ui/Button.js';
import { EmptyState, Poster } from '../components/ui/Media.js';
import { MediaCardText } from '../components/ui/MediaCardText.js';
import { Screen } from '../components/ui/NavBar.js';
import { SearchField } from '../components/ui/SearchField.js';
import { ListSkeleton } from '../components/ui/Skeleton.js';
import { ApiError } from '../lib/api.js';
import { MEDIA_KINDS } from '../lib/mediaKinds.js';
import { useGamesEnabled, useSearchQuery } from '../lib/queries.js';

const DEBOUNCE_MS = 400;

// Keep the last query and kind while the app is open so returning to the tab restores the results.
let savedQuery = '';
let savedScope: MediaTypeFilter = 'all';

export function SearchScreen() {
  const [text, setText] = useState(savedQuery);
  const [debounced, setDebounced] = useState(savedQuery);
  const [chosen, setScope] = useState<MediaTypeFilter>(savedScope);
  const games = useGamesEnabled();
  // `all` searches movies and TV together; games rank on their own scale and stay a kind of their own.
  const scope: MediaTypeFilter = chosen === 'game' && !games ? 'all' : chosen;
  const query = useSearchQuery(debounced, scope);
  const active = debounced.trim().length > 0;
  const what = scope === 'all' ? 'movies and TV series' : MEDIA_KINDS[scope].plural.toLowerCase();
  const done = scope === 'all' ? 'watched' : MEDIA_KINDS[scope].done.toLowerCase();

  useEffect(() => {
    savedScope = chosen;
  }, [chosen]);

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
          placeholder={scope === 'all' ? 'Movies and TV series' : MEDIA_KINDS[scope].plural}
          aria-label={`Search ${what}`}
          autoFocus={false}
        />
      }
    >
      <MediaTypeChips value={scope} onChange={setScope} features={{ games }} className="mb-1" />
      {!active ? (
        <EmptyState
          icon={<MagnifyingGlass />}
          title={`Find something you've ${done}`}
          message={`Search ${what} by title, then mark them ${done} or log a rating.`}
        />
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
          <ul className="reveal safe-x m-0 mt-1 list-none py-0" aria-label="Search results">
            {results.map((r) => (
              <li key={`${r.mediaType}-${r.tmdbId}`}>
                <Link
                  to={`/search/${r.mediaType}/${r.tmdbId}`}
                  className="pressable hairline-b flex items-start gap-3 py-3 no-underline"
                >
                  <Poster
                    src={r.posterUrl}
                    alt={r.title}
                    className="w-16 shrink-0 rounded-xl shadow-[var(--shadow-card)]"
                  />
                  <MediaCardText
                    className="flex-1"
                    title={r.title}
                    titleLines={2}
                    meta={r.releaseYear}
                    mediaType={r.mediaType}
                    showType
                    tmdbRating={r.tmdbRating}
                  />
                  {r.inLibrary && (
                    <span className="mt-0.5 flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--success)_12%,transparent)] px-2 py-1 text-footnote font-semibold text-success">
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
