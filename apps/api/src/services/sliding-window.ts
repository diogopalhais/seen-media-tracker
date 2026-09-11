/**
 * In-memory sliding-window counter keyed by an arbitrary string (usually a client IP).
 * Good enough for one process; swap for a Postgres-backed window if the API is replicated.
 */
export class SlidingWindow {
  private readonly hits = new Map<string, number[]>();
  private lastSweep = 0;

  constructor(
    readonly limit: number,
    readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  private prune(key: string, at: number): number[] {
    const list = (this.hits.get(key) ?? []).filter((t) => at - t < this.windowMs);
    if (list.length === 0) this.hits.delete(key);
    else this.hits.set(key, list);
    return list;
  }

  private sweep(at: number): void {
    if (at - this.lastSweep < this.windowMs) return;
    this.lastSweep = at;
    for (const key of this.hits.keys()) this.prune(key, at);
  }

  count(key: string): number {
    return this.prune(key, this.now()).length;
  }

  remaining(key: string): number {
    return Math.max(0, this.limit - this.count(key));
  }

  isLimited(key: string): boolean {
    return this.count(key) >= this.limit;
  }

  /** Records a hit and returns whether the key is now over the limit (the hit that crosses is rejected). */
  hit(key: string): boolean {
    const at = this.now();
    this.sweep(at);
    const list = this.prune(key, at);
    if (list.length >= this.limit) return true;
    list.push(at);
    this.hits.set(key, list);
    return false;
  }

  reset(key: string): void {
    this.hits.delete(key);
  }

  /** Whole seconds until the oldest hit in the window expires (at least 1 while limited). */
  retryAfterSeconds(key: string): number {
    const at = this.now();
    const list = this.prune(key, at);
    const oldest = list[0];
    if (oldest === undefined) return 0;
    return Math.max(1, Math.ceil((oldest + this.windowMs - at) / 1000));
  }
}
