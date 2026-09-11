import { useSyncExternalStore } from 'react';
import { tokenStore } from './token-store.js';

export function useToken(): string | null {
  return useSyncExternalStore(tokenStore.subscribe, tokenStore.get, () => null);
}

export function useIsAuthenticated(): boolean {
  return useToken() !== null;
}
