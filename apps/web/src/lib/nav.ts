import { useCallback } from 'react';
import { useNavigate } from 'react-router';

/** Back that mirrors the browser: pops history when there is any, otherwise replaces with the tab root (deep links). */
export function useBack(fallback: string): () => void {
  const navigate = useNavigate();
  return useCallback(() => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(fallback, { replace: true });
  }, [navigate, fallback]);
}
