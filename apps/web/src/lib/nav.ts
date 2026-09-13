import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { previousVisit, tabRootOf } from './history-log.js';

/**
 * In-app Back. Pops browser history when the previous entry is inside the same tab (so the browser's
 * back gesture and this control agree); after a tab switch or a deep link it goes to the parent screen.
 */
export function useBack(fallback: string): () => void {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(() => {
    const prev = previousVisit();
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    const sameTab = prev !== undefined && tabRootOf(prev) === tabRootOf(location.pathname);
    if (idx > 0 && sameTab) navigate(-1);
    else navigate(fallback, { replace: true });
  }, [navigate, fallback, location.pathname]);
}
