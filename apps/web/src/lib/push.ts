import type { PushSubscriptionRequest } from '@seen/shared';
import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { isIosSafari, isStandalone } from './pwa.js';

export type PushSupport = 'supported' | 'needs_install' | 'unsupported';

/** iOS only exposes Web Push inside an installed app, so Safari there gets an install hint instead. */
export function pushSupport(
  env: {
    hasServiceWorker: boolean;
    hasPushManager: boolean;
    hasNotification: boolean;
    iosSafari: boolean;
    standalone: boolean;
  } = detectEnv(),
): PushSupport {
  if (env.hasServiceWorker && env.hasPushManager && env.hasNotification) return 'supported';
  return env.iosSafari && !env.standalone ? 'needs_install' : 'unsupported';
}

function detectEnv() {
  const w = typeof window === 'undefined' ? undefined : window;
  return {
    hasServiceWorker: Boolean(w && 'serviceWorker' in navigator),
    hasPushManager: Boolean(w && 'PushManager' in w),
    hasNotification: Boolean(w && 'Notification' in w),
    iosSafari: isIosSafari(),
    standalone: isStandalone(),
  };
}

/** VAPID public keys are URL-safe base64; `subscribe()` wants the raw bytes. */
export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export function toSubscriptionRequest(sub: PushSubscription): PushSubscriptionRequest {
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth)
    throw new Error('Push subscription is missing its endpoint or keys');
  return {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    userAgent: navigator.userAgent.slice(0, 400),
  };
}

async function registration(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.ready;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== 'supported') return null;
  try {
    return await (await registration()).pushManager.getSubscription();
  } catch {
    return null;
  }
}

export type EnableResult = 'enabled' | 'denied';

/** Must run from a user gesture (iOS refuses the permission prompt otherwise). */
export async function enablePush(publicKey: string): Promise<EnableResult> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';
  const reg = await registration();
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    }));
  await api.subscribePush(toSubscriptionRequest(sub));
  return 'enabled';
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  try {
    await api.unsubscribePush({ endpoint: sub.endpoint });
  } catch {
    // The device-side unsubscribe below is what stops deliveries; the server prunes dead endpoints.
  }
  await sub.unsubscribe();
}

/** On launch: re-register whatever this device still holds, so a restored server or a re-issued endpoint heals. */
export async function syncPushSubscription(): Promise<void> {
  if (pushSupport() !== 'supported' || Notification.permission !== 'granted') return;
  const sub = await currentSubscription();
  if (!sub) return;
  try {
    await api.subscribePush(toSubscriptionRequest(sub));
  } catch {
    // Offline or push disabled server-side; nothing to do now.
  }
}

export interface PushState {
  support: PushSupport;
  permission: NotificationPermission | 'unsupported';
  /** This device holds a subscription. */
  enabled: boolean;
  busy: boolean;
  error: string | null;
}

export function usePushState(publicKey: string | null | undefined) {
  const support = pushSupport();
  const [state, setState] = useState<PushState>({
    support,
    permission: support === 'supported' ? Notification.permission : 'unsupported',
    enabled: false,
    busy: false,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    void currentSubscription().then((sub) => {
      if (!cancelled) setState((s) => ({ ...s, enabled: sub !== null }));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setEnabled = useCallback(
    async (on: boolean) => {
      if (!publicKey) return;
      setState((s) => ({ ...s, busy: true, error: null }));
      try {
        if (on) {
          const result = await enablePush(publicKey);
          setState((s) => ({
            ...s,
            busy: false,
            enabled: result === 'enabled',
            permission: Notification.permission,
            error: result === 'denied' ? 'Notifications were not allowed.' : null,
          }));
        } else {
          await disablePush();
          setState((s) => ({ ...s, busy: false, enabled: false }));
        }
      } catch (err) {
        setState((s) => ({
          ...s,
          busy: false,
          error: err instanceof Error ? err.message : 'Could not change notifications.',
        }));
      }
    },
    [publicKey],
  );

  return { state, setEnabled };
}
