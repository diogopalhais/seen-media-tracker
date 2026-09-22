import { BellSimple, BellSimpleSlash } from '@phosphor-icons/react';
import type { LibraryItemDetail } from '@seen/shared';
import { ApiError } from '../lib/api.js';
import { useSetMutedMutation } from '../lib/queries.js';
import { InsetGroupedList, Row } from './ui/InsetGroupedList.js';
import { Switch } from './ui/Switch.js';

/**
 * "Following" switch for a series in the library. Off means the owner stopped watching: no place on
 * the New & upcoming shelf, no badge in the grid, no new-episode notification.
 */
export function FollowRow({ detail }: { detail: LibraryItemDetail }) {
  const setMuted = useSetMutedMutation();
  if (detail.item.mediaType !== 'tv') return null;
  const following = !detail.muted;
  const error =
    setMuted.error instanceof ApiError
      ? setMuted.error.message
      : setMuted.error
        ? 'Could not save. Please try again.'
        : null;
  return (
    <InsetGroupedList
      className="mt-3"
      footer={
        error ??
        (following
          ? 'New episodes show up in your library and can notify your devices.'
          : 'Stopped watching. No alerts or notifications for this series until you follow it again.')
      }
    >
      <Row
        label={following ? 'Following' : 'Not following'}
        detail="New-episode alerts and notifications"
        icon={
          following ? (
            <BellSimple className="size-5" aria-hidden="true" />
          ) : (
            <BellSimpleSlash className="size-5" aria-hidden="true" />
          )
        }
        value={
          <Switch
            checked={following}
            busy={setMuted.isPending}
            onChange={(checked) => setMuted.mutate({ id: detail.item.id, muted: !checked })}
            aria-label="Follow new episodes"
          />
        }
      />
    </InsetGroupedList>
  );
}
