import { formatEpisode, latestTodayOnEarth } from '@seen/shared';
import type { Logger } from '../logger.js';
import type { LibraryRepository } from './library.js';
import type { PushService } from './push.js';
import type { SnapshotRefresher } from './refresh.js';

export const NOTIFIER_INTERVAL_MS = 60 * 60 * 1000;
export const NOTIFIER_INITIAL_DELAY_MS = 60 * 1000;

/**
 * Hourly: refresh running series, then announce every newly aired episode the owner has not watched.
 * Announced episodes are remembered per series, so a run never repeats itself.
 */
export class EpisodeNotifier {
  private running: Promise<{ announced: number }> | null = null;

  constructor(
    private readonly library: LibraryRepository,
    private readonly refresher: SnapshotRefresher,
    private readonly push: PushService,
    private readonly now: () => Date,
    private readonly logger: Logger,
  ) {}

  runOnce(): Promise<{ announced: number }> {
    // Overlapping runs (a slow provider plus the interval firing) would double-announce.
    if (!this.running) this.running = this.run().finally(() => (this.running = null));
    return this.running;
  }

  private async run(): Promise<{ announced: number }> {
    if (!this.push.enabled) return { announced: 0 };
    try {
      await this.refresher.refreshStale();
    } catch (err) {
      this.logger.warn({ err }, 'notifier: refresh failed, using stored snapshots');
    }
    const today = latestTodayOnEarth(this.now());
    const pending = await this.library.pendingAnnouncements(today);
    let announced = 0;
    for (const p of pending) {
      await this.library.markAnnounced(p.id, p.episode);
      if (!p.unwatched) continue;
      const result = await this.push.broadcast({
        kind: 'new_episode',
        title: p.title,
        body: `New episode · ${formatEpisode(p.episode)}${p.episode.name ? ` · ${p.episode.name}` : ''}`,
        url: `/library/${p.id}`,
        tag: `episode-${p.id}`,
      });
      announced++;
      this.logger.info(
        { itemId: p.id, episode: formatEpisode(p.episode), ...result },
        'announced episode',
      );
    }
    return { announced };
  }

  /** Starts the schedule; returns a function that stops it. */
  start(intervalMs = NOTIFIER_INTERVAL_MS, initialDelayMs = NOTIFIER_INITIAL_DELAY_MS): () => void {
    const tick = () => {
      this.runOnce().catch((err: unknown) => this.logger.error({ err }, 'notifier run failed'));
    };
    const first = setTimeout(tick, initialDelayMs);
    const every = setInterval(tick, intervalMs);
    first.unref?.();
    every.unref?.();
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  }
}
