const KEY = 'seen.token';
type ClearReason = 'logout' | 'expired';

const listeners = new Set<() => void>();
let memoryToken: string | null = null;
let lastClearReason: ClearReason | null = null;

function safeStorage(): Storage | null {
  try {
    const s = window.localStorage;
    s.getItem(KEY);
    return s;
  } catch {
    return null;
  }
}

function emit() {
  for (const l of listeners) l();
}

/** Bearer token persisted in localStorage, with an in-memory fallback when storage is unavailable. */
export const tokenStore = {
  get(): string | null {
    const s = safeStorage();
    if (s) {
      const v = s.getItem(KEY);
      if (v) return v;
    }
    return memoryToken;
  },
  set(token: string): void {
    memoryToken = token;
    lastClearReason = null;
    safeStorage()?.setItem(KEY, token);
    emit();
  },
  clear(reason: ClearReason): void {
    memoryToken = null;
    lastClearReason = reason;
    safeStorage()?.removeItem(KEY);
    emit();
  },
  consumeClearReason(): ClearReason | null {
    const r = lastClearReason;
    lastClearReason = null;
    return r;
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
