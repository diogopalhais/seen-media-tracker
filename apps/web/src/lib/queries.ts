import type {
  EpisodeWatch,
  LibraryItemDetail,
  LibrarySort,
  LogWatchRequest,
  MediaType,
  MediaTypeFilter,
  SetEpisodesWatchedRequest,
  UpdateWatchRequest,
} from '@seen/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api.js';

export const queryKeys = {
  session: ['session'] as const,
  library: (filters: { type: MediaTypeFilter; sort: LibrarySort }) => ['library', filters] as const,
  libraryAll: ['library'] as const,
  // Shares the 'library' prefix so watch mutations invalidate it along with the list.
  libraryReleases: ['library', 'releases'] as const,
  libraryItem: (id: string) => ['library-item', id] as const,
  search: (q: string, type: MediaTypeFilter) => ['search', q, type] as const,
  searchAll: ['search'] as const,
  title: (type: MediaType, id: number) => ['title', type, id] as const,
  discover: ['discover'] as const,
  season: (id: number, n: number) => ['season', id, n] as const,
  pushConfig: ['push-config'] as const,
};

export function useSessionQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.session,
    queryFn: api.session,
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useLibraryQuery(filters: { type: MediaTypeFilter; sort: LibrarySort }) {
  return useInfiniteQuery({
    queryKey: queryKeys.library(filters),
    queryFn: ({ pageParam }) =>
      api.library({ ...filters, ...(pageParam ? { cursor: pageParam } : {}) }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 30_000,
  });
}

export function usePushConfigQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.pushConfig,
    queryFn: api.pushConfig,
    enabled,
    staleTime: 60 * 60_000,
  });
}

export function useLibraryReleasesQuery() {
  return useQuery({
    queryKey: queryKeys.libraryReleases,
    queryFn: api.libraryReleases,
    staleTime: 60_000,
  });
}

export function useLibraryItemQuery(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.libraryItem(id ?? ''),
    queryFn: () => api.libraryItem(id as string),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

export function useSearchQuery(q: string, type: MediaTypeFilter) {
  const trimmed = q.trim();
  return useQuery({
    queryKey: queryKeys.search(trimmed, type),
    queryFn: ({ signal }) => api.search(trimmed, type, 1, signal),
    enabled: trimmed.length > 0,
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

export function useTitleQuery(type: MediaType | undefined, id: number | undefined) {
  return useQuery({
    queryKey: queryKeys.title(type ?? 'movie', id ?? 0),
    queryFn: () => api.title(type as MediaType, id as number),
    enabled: Boolean(type && id),
    staleTime: 60 * 60_000,
  });
}

export function useDiscoverQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.discover,
    queryFn: api.discover,
    enabled,
    staleTime: 60 * 60_000,
    retry: 1,
  });
}

export function useSeasonQuery(tmdbId: number | undefined, seasonNumber: number | undefined) {
  return useQuery({
    queryKey: queryKeys.season(tmdbId ?? 0, seasonNumber ?? -1),
    queryFn: () => api.season(tmdbId as number, seasonNumber as number),
    enabled: tmdbId !== undefined && seasonNumber !== undefined,
    staleTime: 60 * 60_000,
  });
}

/** Everything that displays library state, so a single mutation refreshes grid, detail, search badges and title previews. */
function useInvalidateLibrary() {
  const qc = useQueryClient();
  return async (item: { id: string; mediaType: MediaType; tmdbId: number } | undefined) => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.libraryAll }),
      qc.invalidateQueries({ queryKey: queryKeys.searchAll }),
      qc.invalidateQueries({ queryKey: queryKeys.discover }),
      item ? qc.invalidateQueries({ queryKey: queryKeys.libraryItem(item.id) }) : Promise.resolve(),
      item
        ? qc.invalidateQueries({ queryKey: queryKeys.title(item.mediaType, item.tmdbId) })
        : Promise.resolve(),
    ]);
  };
}

export function useLogWatchMutation() {
  const invalidate = useInvalidateLibrary();
  return useMutation({
    mutationFn: (body: LogWatchRequest) => api.logWatch(body),
    onSuccess: (res) => invalidate(res.item),
  });
}

export function useUpdateWatchMutation() {
  const invalidate = useInvalidateLibrary();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateWatchRequest }) =>
      api.updateWatch(id, body),
    onSuccess: (res) => invalidate(res.item),
  });
}

/** Stop or resume following a series (release alerts and notifications). */
export function useSetMutedMutation() {
  const invalidate = useInvalidateLibrary();
  return useMutation({
    mutationFn: ({ id, muted }: { id: string; muted: boolean }) =>
      api.updateLibraryItem(id, { muted }),
    onSuccess: (res) => invalidate(res.item),
  });
}

export function useDeleteWatchMutation() {
  const invalidate = useInvalidateLibrary();
  return useMutation({
    mutationFn: ({
      id,
    }: {
      id: string;
      item: { id: string; mediaType: MediaType; tmdbId: number };
    }) => api.deleteWatch(id),
    onSuccess: (_res, vars) => invalidate(vars.item),
  });
}

export function useLogoutMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.logout(),
    onSettled: () => qc.clear(),
  });
}

/**
 * Marks/unmarks episodes with an optimistic update of the cached item detail (when the series is
 * already in the library) and a rollback on failure. Afterwards the item, library, search badges and
 * title details are refreshed so every screen agrees.
 */
export function useSetEpisodesWatchedMutation(tmdbId: number, itemId: string | undefined) {
  const qc = useQueryClient();
  const invalidate = useInvalidateLibrary();
  return useMutation({
    mutationFn: (body: Omit<SetEpisodesWatchedRequest, 'tmdbId'>) =>
      api.setEpisodesWatched({ tmdbId, ...body }),
    onMutate: async (body) => {
      if (!itemId) return { previous: undefined };
      const key = queryKeys.libraryItem(itemId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<LibraryItemDetail>(key);
      if (previous) {
        const today = new Date().toISOString().slice(0, 10);
        const keyOf = (w: { seasonNumber: number; episodeNumber: number }) =>
          `${w.seasonNumber}:${w.episodeNumber}`;
        const wanted = new Set(body.episodes.map(keyOf));
        let next: EpisodeWatch[];
        if (body.watched) {
          const existing = new Set(previous.episodeWatches.map(keyOf));
          const added = body.episodes
            .filter((e) => !existing.has(keyOf(e)))
            .map((e) => ({ ...e, watchedOn: body.watchedOn ?? today }));
          next = [...previous.episodeWatches, ...added].sort(
            (a, b) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber,
          );
        } else {
          next = previous.episodeWatches.filter((w) => !wanted.has(keyOf(w)));
        }
        qc.setQueryData<LibraryItemDetail>(key, { ...previous, episodeWatches: next });
      }
      return { previous };
    },
    onError: (_err, _body, context) => {
      if (itemId && context?.previous)
        qc.setQueryData(queryKeys.libraryItem(itemId), context.previous);
    },
    onSuccess: (res) => {
      const key = queryKeys.libraryItem(res.item.id);
      const current = qc.getQueryData<LibraryItemDetail>(key);
      if (current)
        qc.setQueryData<LibraryItemDetail>(key, {
          ...current,
          item: res.item,
          episodeWatches: res.episodeWatches,
        });
      void invalidate({ id: res.item.id, mediaType: 'tv', tmdbId });
    },
  });
}
