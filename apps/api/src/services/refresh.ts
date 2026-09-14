import type { LibraryRepository } from './library.js';
import { detailsFor, type MetadataProvider } from './metadata/provider.js';

export interface RefreshOptions {
  /** Snapshots older than this are refreshed. */
  maxAgeMs: number;
  /** At most this many series per request. */
  batch: number;
  /** How long a request waits for refreshes before answering from the stored snapshots. */
  budgetMs: number;
}

export const DEFAULT_REFRESH: RefreshOptions = {
  maxAgeMs: 6 * 60 * 60 * 1000,
  batch: 6,
  budgetMs: 2000,
};

/**
 * Keeps the broadcast state (status, last/next episode) of running series current enough for release
 * alerts. Ended and canceled series are never touched. Refreshes past the time budget finish in the
 * background, so at worst the next request sees them.
 */
export class SnapshotRefresher {
  private readonly inflight = new Map<string, Promise<void>>();
  private readonly opts: RefreshOptions;

  constructor(
    private readonly library: LibraryRepository,
    private readonly provider: MetadataProvider,
    private readonly now: () => Date,
    private readonly onError: (err: unknown, itemId: string) => void = () => {},
    opts: Partial<RefreshOptions> = {},
  ) {
    this.opts = { ...DEFAULT_REFRESH, ...opts };
  }

  async refreshStale(): Promise<void> {
    const before = new Date(this.now().getTime() - this.opts.maxAgeMs);
    const stale = await this.library.staleShows(before, this.opts.batch);
    if (stale.length === 0) return;
    const jobs = stale.map((row) => {
      const running = this.inflight.get(row.id);
      if (running) return running;
      const job = detailsFor(this.provider, row.mediaType, row.tmdbId)
        .then((details) => this.library.upsertItem(details, this.now()))
        .then(() => undefined)
        .catch((err: unknown) => this.onError(err, row.id))
        .finally(() => this.inflight.delete(row.id));
      this.inflight.set(row.id, job);
      return job;
    });
    await Promise.race([
      Promise.allSettled(jobs),
      new Promise<void>((resolve) => setTimeout(resolve, this.opts.budgetMs).unref?.()),
    ]);
  }
}
