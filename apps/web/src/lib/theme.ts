import { useCallback, useSyncExternalStore } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';
const KEY = 'seen.theme';
const LIGHT_BAR = '#f5f5f7';
const DARK_BAR = '#0a0a0b';
const listeners = new Set<() => void>();

function read(): ThemePreference {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

function systemIsDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches === true
  );
}

/** Applies the preference to <html data-theme> and keeps the browser theme-color in sync. */
export function applyTheme(pref: ThemePreference = read()): void {
  const root = document.documentElement;
  if (pref === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', pref);
  const dark = pref === 'dark' || (pref === 'system' && systemIsDark());
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    if (pref === 'system') {
      const media = meta.getAttribute('media') ?? '';
      meta.content = media.includes('dark') ? DARK_BAR : LIGHT_BAR;
    } else {
      meta.content = dark ? DARK_BAR : LIGHT_BAR;
    }
  }
}

export function setThemePreference(pref: ThemePreference): void {
  try {
    if (pref === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    // Storage unavailable; the in-page attribute still applies for this session.
  }
  applyTheme(pref);
  for (const l of listeners) l();
}

export function useThemePreference(): [ThemePreference, (p: ThemePreference) => void] {
  const pref = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => 'system' as ThemePreference,
  );
  return [pref, useCallback(setThemePreference, [])];
}

/** Re-applies theme-color when the OS appearance changes and the user follows the system. */
export function watchSystemTheme(): () => void {
  const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
  if (!mq) return () => {};
  const handler = () => {
    if (read() === 'system') applyTheme('system');
  };
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}
