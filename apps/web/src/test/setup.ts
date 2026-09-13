import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// jsdom lacks a few browser APIs that Radix and our observers rely on.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
if (!('ResizeObserver' in window))
  (window as unknown as { ResizeObserver: unknown }).ResizeObserver = NoopObserver;
if (!('IntersectionObserver' in window))
  (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = NoopObserver;

if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {};
if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
if (!window.visualViewport) {
  Object.defineProperty(window, 'visualViewport', {
    value: {
      width: 390,
      height: 844,
      offsetTop: 0,
      addEventListener: () => {},
      removeEventListener: () => {},
    },
  });
}
