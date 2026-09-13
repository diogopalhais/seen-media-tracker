import { SmileyMeh } from '@phosphor-icons/react';
import { Button } from '../components/ui/Button.js';
import { EmptyState } from '../components/ui/Media.js';
import { Screen } from '../components/ui/NavBar.js';
import { PosterRow } from '../components/ui/PosterRow.js';
import { ApiError } from '../lib/api.js';
import { useDiscoverQuery } from '../lib/queries.js';

/** Browse what is trending and popular; every card opens inside this tab's stack. */
export function DiscoverScreen() {
  const discover = useDiscoverQuery(true);
  return (
    <Screen title="Discover" large>
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
      ) : (
        <div className="pb-2">
          <PosterRow
            title="Trending this week"
            subtitle="What everyone is watching right now"
            items={discover.data?.trending}
            mixed
            loading={discover.isPending}
            basePath="/discover"
          />
          <PosterRow
            title="Popular Movies"
            subtitle="Most popular movies this week"
            items={discover.data?.popularMovies}
            loading={discover.isPending}
            basePath="/discover"
          />
          <PosterRow
            title="Popular TV Series"
            subtitle="Series people keep coming back to"
            items={discover.data?.popularTv}
            loading={discover.isPending}
            basePath="/discover"
          />
        </div>
      )}
    </Screen>
  );
}
