import { useRegisterSW } from 'virtual:pwa-register/react';
import { useEffect, useRef } from 'react';
import { Banner } from '../components/ui/Banner.js';

const LAUNCHED_AT = Date.now();
/** A new version found this soon after launch is applied silently; nothing private has rendered yet. */
const SILENT_UPDATE_WINDOW_MS = 3000;

export function PwaUpdater() {
  const applied = useRef(false);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Check for a newer build on every launch, then hourly while the app stays open.
      void registration?.update();
      if (registration) setInterval(() => void registration.update(), 60 * 60 * 1000);
    },
  });

  useEffect(() => {
    if (needRefresh && !applied.current && Date.now() - LAUNCHED_AT < SILENT_UPDATE_WINDOW_MS) {
      applied.current = true;
      void updateServiceWorker(true);
    }
  }, [needRefresh, updateServiceWorker]);

  if (!needRefresh || applied.current) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px)+1rem)] z-50 md:bottom-4 md:left-64">
      <Banner
        tone="info"
        className="pointer-events-auto mx-auto max-w-md"
        onRetry={() => {
          applied.current = true;
          void updateServiceWorker(true);
        }}
        retryLabel="Reload"
        onDismiss={() => setNeedRefresh(false)}
      >
        A new version of Seen is available.
      </Banner>
    </div>
  );
}
