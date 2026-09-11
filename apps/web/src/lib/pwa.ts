import { useEffect, useSyncExternalStore } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => {
  for (const l of listeners) l();
};

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true || nav.standalone === true
  );
}

export function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return isIos && isSafari;
}

export type InstallState =
  | { kind: 'installed' }
  | { kind: 'prompt' }
  | { kind: 'ios' }
  | { kind: 'unsupported' };

function computeInstallState(): InstallState {
  if (isStandalone()) return { kind: 'installed' };
  if (deferredPrompt) return { kind: 'prompt' };
  if (isIosSafari()) return { kind: 'ios' };
  return { kind: 'unsupported' };
}

let cached = computeInstallState();
const recompute = () => {
  cached = computeInstallState();
};

export function useInstallState(): InstallState {
  useEffect(() => {
    const mq = window.matchMedia?.('(display-mode: standalone)');
    const handler = () => {
      recompute();
      notify();
    };
    mq?.addEventListener('change', handler);
    return () => mq?.removeEventListener('change', handler);
  }, []);
  return useSyncExternalStore(
    (l) => {
      listeners.add(() => {
        recompute();
        l();
      });
      return () => listeners.delete(l);
    },
    () => cached,
    () => ({ kind: 'unsupported' as const }),
  );
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable';
  const evt = deferredPrompt;
  await evt.prompt();
  const { outcome } = await evt.userChoice;
  deferredPrompt = null;
  recompute();
  notify();
  return outcome;
}
